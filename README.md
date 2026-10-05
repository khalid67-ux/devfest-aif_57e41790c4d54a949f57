# Smart Escape

Frontend-only solution for the AI DevFest 2026 Smart Escape practice challenge.

## Run

No build step is required.

1. Open `index.html` in Chrome, or deploy the folder to GitHub Pages / Vercel / Netlify.
2. Click **Load sample** to test the supplied interaction.
3. Click **Import JSON** to load the judge dataset (`building.json`).
4. Select a start room/junction.
5. Click nodes to block/unblock rooms/junctions.
6. Click exits to close/reopen them.
7. Click corridors to block/unblock them.
8. Click **Reset** to restore the original `initial_state`.
9. Use **বাংলা / English** to switch the interface language.

## Routing

The app uses Dijkstra's algorithm with the exact required ordering:

1. Lowest total edge-cost.
2. If total cost ties, lexicographically smallest exit ID.
3. If the selected exit also ties, lexicographically smallest node-ID sequence.

Coordinates are used only for drawing the graph. They never affect route cost.

Blocked nodes remove the node and all incident corridors. Blocked corridors remove only that edge. Closed exits cannot be destinations.

## Validation

The app validates:
- unique node and edge IDs
- node types
- coordinates
- positive integer edge costs
- valid edge endpoints
- no self-loops
- no repeated undirected node pairs
- valid `initial_state` IDs/categories
- required room/junction and exit presence

## Competition requirements covered

- Frontend only
- Local JSON import
- Interactive map with labels and corridor costs
- Start selection
- Hazard toggling
- Immediate rerouting
- Reset to original state
- No-route and blocked-start states
- English/Bangla UI
- Subtle route/hazard animations
- Professional responsive dashboard UI
- Map zoom controls
- Accessible focus states and semantic controls
- No external API required for routing
