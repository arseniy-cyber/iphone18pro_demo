# FORM — iPhone 18 Pro Max Burgundy Concept (V9)

Independent interactive portfolio demo by Lumo Sites. Not affiliated with Apple.

## Run / deploy

Upload the *contents* of this folder to the repository root. Keep `index.html`, `main.js`, `style.css` and the whole `assets/` folder together. GitHub Pages: main branch, root `/`.

The external Three.js dependency is loaded from jsDelivr. Network access is required when opening the site. A local server (e.g. `python -m http.server 8000`) is recommended for local testing; do not open `index.html` directly by double-clicking.

## V9 changes

- Compact, controlled scroll-driven exploded view, with a deliberate initial camera pullback.
- Matte opaque display rear backing attached directly behind the original display geometry; no floating black plate.
- Removed the previous extra rear-cover mesh; original source rear shell is rendered double-sided and opaque.
- Lens group and black sensor/carrier are separate objects with a small axial offset at the camera stage.
- Full-bleed screenshot of the user's Lumo Sites on the display: no Safari bottom chrome or padded thumbnail.
- Animated transitions white/silver → graphite → burgundy accents → light via CSS layers driven by scroll progress. Text switches contrast in the dark phase.
- Additional editorial typography and concise component narrative.
- Volumetric smoke is absent.

## Notes

The outer model is a third-party GLB. Preserve the model attribution and license requirements in `LICENSE_MODEL.txt`.
The internals are visual reconstruction, not a certified engineering representation of a real Apple product.

Optional debugging: `?view=front`, `?view=rear`, `?view=exploded` in the URL. Drag horizontally/vertically on the model to orbit, scroll down to disassemble, back up to reassemble.

## V10 — chassis interior
Fixed the hollow/transparent appearance of the central chassis by rendering the original metal from both sides and introducing a fixed opaque graphite midframe bulkhead with real 3D inner walls. The detachable rear cover, all animations, layout and scroll interactions are unchanged.
