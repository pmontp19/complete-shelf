import * as THREE from 'three';
import type { BookRig, ShelfBook, ShelfContext } from './types';
import { createBookCase, spineArtPlaneSize, type BookDimensions } from './geometry';
import { createBookMaterials } from './materials';
import { createSpineTexture, hashSeed, loadTextureSafe, seededRandom } from './textures';

// Books lean the way books lean. Deterministic per volume, straightened as a
// book comes to the centre (that half of the behaviour lives in layout.ts,
// which reads `rig.lean` computed here).
const MAX_LEAN = 0.035;

/**
 * `BookRig` plus one addition beyond the frozen contract in `types.ts`:
 * `setInteriorVisible`, which the layout calls to hide the meshes a volume's
 * own outer shell already fully occludes at opacity 1 (see
 * `BookCase.interiorMeshes`), the moment it stops being fully opaque.
 * Typed as an extension rather than a `types.ts` change so the frozen
 * contract's field list stays untouched; `ctx.rigs` stays `BookRig[]` and
 * this extra method is reached through a narrowing cast where it is used.
 */
export interface HardcoverRig extends BookRig {
  setInteriorVisible(visible: boolean): void;
  /** Drives the jacket's varnish highlight: strength 0..1, elapsed in seconds. */
  setSheen(strength: number, elapsed: number): void;
}

/** Assembles one volume: its case, materials, contact shadow and idle pose. */
export function buildBookRig(args: {
  ctx: ShelfContext;
  book: ShelfBook;
  index: number;
  dims: BookDimensions;
  textureLoader: THREE.TextureLoader;
  shared: {
    pageEdgeTexture: THREE.Texture;
    contactShadowTexture: THREE.Texture;
    contactShadowGeometry: THREE.PlaneGeometry;
  };
  onCoverSettled: () => void;
  onTextureReady: () => void;
}): HardcoverRig {
  const { ctx, book, index, dims, textureLoader, shared, onCoverSettled, onTextureReady } = args;

  const root = new THREE.Group();
  root.name = `book-${book.id}`;
  const motion = new THREE.Group();
  root.add(motion);

  const materials = createBookMaterials(book, dims, { pageEdgeTexture: shared.pageEdgeTexture });
  // The procedurally generated spine texture (books without a real
  // `spineUrl`) is created inside `createBookMaterials` and needs disposing
  // same as any other per-book texture; one loaded from `spineUrl` is
  // registered below, once it resolves.
  if (materials.spineArt.map) ctx.disposables.push(materials.spineArt.map);
  ctx.disposables.push(...materials.all);
  // Not in `materials.all` (see `BookMaterials.jacketSheen`), so it needs
  // registering on its own or it would be the one material that leaks.
  ctx.disposables.push(materials.jacketSheen);

  const bookCase = createBookCase(dims, materials);
  ctx.disposables.push(...bookCase.geometries, bookCase.pickMesh.material as THREE.Material);
  bookCase.pickMesh.userData.bookIndex = index;
  motion.add(bookCase.group);

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shared.contactShadowTexture,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shared.contactShadowGeometry, shadowMaterial);
  ctx.disposables.push(shadowMaterial);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.scale.set(dims.width * 1.7, dims.width * 1.1, 1);
  shadowMesh.renderOrder = -1;
  ctx.shelfGroup.add(shadowMesh);

  ctx.shelfGroup.add(root);

  // Cover art — falls back to the flat spineColor material above until (or unless) it loads.
  // Color flips to white the moment `.map` is set: a physical material
  // multiplies map by color, so tinting a texture that already carries the
  // cover art would square the ground and drag it toward black.
  void loadTextureSafe(textureLoader, book.coverUrl).then((texture) => {
    if (ctx.destroyed) {
      texture?.dispose();
      return;
    }
    if (texture) {
      materials.frontArt.map = texture;
      materials.frontArt.color.set(0xffffff);
      materials.frontArt.needsUpdate = true;
      ctx.disposables.push(texture);
    }
    onCoverSettled();
    onTextureReady();
  });

  if (book.spineUrl) {
    void loadTextureSafe(textureLoader, book.spineUrl).then((texture) => {
      if (ctx.destroyed) {
        texture?.dispose();
        return;
      }
      if (texture) {
        materials.spineArt.map = texture;
        materials.spineArt.color.set(0xffffff);
        ctx.disposables.push(texture);
      } else {
        const spineArtSize = spineArtPlaneSize(dims);
        const generated = createSpineTexture(book, spineArtSize.width / spineArtSize.height);
        materials.spineArt.map = generated;
        materials.spineArt.color.set(0xffffff);
        ctx.disposables.push(generated);
      }
      materials.spineArt.needsUpdate = true;
      onTextureReady();
    });
  }

  const lean = (seededRandom(hashSeed(`${book.id}-lean`))() * 2 - 1) * MAX_LEAN;

  function setVisible(visible: boolean): void {
    for (const mesh of bookCase.meshes) mesh.visible = visible;
    bookCase.pickMesh.visible = visible;
  }

  // Called every frame, after `setVisible` above: that loop already drove
  // every mesh (interior included) to whichever of true/false the fade's
  // 0.02 cutoff wants, so this only ever has to *narrow* that back down to
  // the shell subset while the volume is somewhere in the middle of a fade.
  function setInteriorVisible(visible: boolean): void {
    for (const mesh of bookCase.interiorMeshes) mesh.visible = visible;
  }

  /**
   * Drives the varnish highlight. `strength` 0 hides the plane outright rather
   * than drawing a fully transparent one, which is what keeps the 21 volumes
   * that are racked spine-out at any moment from each costing an additive pass
   * for a highlight nobody can see. `elapsed` is wall-clock seconds, so the
   * sweep's speed does not depend on the frame rate.
   */
  function setSheen(strength: number, elapsed: number): void {
    const visible = strength > 0.001;
    bookCase.sheenMesh.visible = visible;
    if (!visible) return;
    materials.jacketSheen.uniforms.uStrength.value = strength;
    materials.jacketSheen.uniforms.uTime.value = elapsed;
  }

  return {
    book,
    index,
    dims,
    root,
    motion,
    pickMesh: bookCase.pickMesh,
    shadowMesh,
    shadowMaterial,
    materials: materials.all,
    lean,
    hover: 0,
    setVisible,
    setInteriorVisible,
    setSheen,
  };
}
