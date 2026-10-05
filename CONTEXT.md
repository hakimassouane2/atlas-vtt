# Atlas VTT

A virtual tabletop inside Obsidian: the GM runs scenes on a canvas, and players see them in a player window or join online from a browser.

## Online play

**Online session**:
A table's live link through which players join the presented scene from a browser. One link for the whole table: it identifies no individual player.
_Avoid_: server, room, lobby

**Player client**:
The browser page a player opens from the online session's link. It runs Atlas' own canvas on a copy of the presented scene, shown in player view.
_Avoid_: web client, remote view

**Player view**:
The scene as players may see it: what the GM's canvas shows with GM view switched off. Fog of war decides what is revealed; dynamic lighting plays no part online.
_Avoid_: session view, player mode

**Player-controlled token**:
A character token the GM has marked "Controlled by players". Anyone at the table can act on it through the player client; there is no per-player ownership.
_Avoid_: owned token, player token

**Held token**:
A token someone is dragging. While a player holds it, nobody else can take it, and everyone sees it move.
_Avoid_: locked token, grabbed token

**Player command**:
A request from a player client to change the scene (move, change a resource, set a condition, roll, rotate). The GM's Atlas applies it at once, and only to player-controlled tokens. The GM's undo never takes it back.
_Avoid_: action, edit, event
