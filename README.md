# Sonomika Patch

Sonomika Patch is a browser app for audio-visual patches. Each patch is a self-contained piece of code that generates its own music and visuals in real time, with a mixer, effects, MIDI control and video export. It is free and open code.

Use **Save patch** to export a portable `.patch` with the player, patch code, settings, and media. Drop it onto Sonomika Patch or use **Open patch**. The isolated player uses CDN dependencies for icons, fonts, and 3D rendering. **Save preset** exports settings for the matching built-in patch. Opening a preset replaces its saved mixer settings and layout.

The app uses query parameters so direct links work on a static host, including from a subdirectory. Existing hash links still work.

- Patch library — `?view=library`
- Modules — `?view=modules`
- Memory details — `?view=library&patch=drizzle`
- Memory wires — `?view=patch&patch=drizzle`
- Memory grid — `?view=grid&patch=drizzle`
- Memory mixer — `?view=mixer&patch=drizzle`

`index.html` contains the app shell and declares the script load order. The app runs directly from a static server.

- `patches/<name>/patch.js` contains each patch's definition and implementation. Its `images/` and `audio/` folders hold its media where applicable. Asset URLs are relative to the app page.
- `patches/index.js` lists patches in library order. Add a new patch script to `index.html` before this registry and add its definition to the registry. Keep existing patch IDs stable because URLs and saved settings use them.
- `patches/shared/` contains visual code used by multiple patches.
- `modules/` contains the shared effects and meters. Its registry lists the master and return devices used by the mixer and module library. Patch-specific voices and slicers live with their patches.
- `engine/` contains the shared audio engine and visual renderer.
- `app/`, `views/`, and `styles/` contain startup controls, the app screens, and their layout and themes.
