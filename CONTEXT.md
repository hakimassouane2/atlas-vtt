# Atlas VTT

A virtual tabletop inside Obsidian: the GM runs scenes on a canvas, and players see them in a player window or join online from a browser.

## Online play

**Online session**:
A table's live link through which players join the presented scene from a browser. One link for the whole table: each player then says who they are by choosing a player profile.
_Avoid_: server, room, lobby

**Player client**:
The browser page a player opens from the online session's link. It runs Atlas' own canvas on a copy of the presented scene, shown in player view.
_Avoid_: web client, remote view

**Player view**:
The scene as players may see it: what the GM's canvas shows with GM view switched off. Fog of war decides what is revealed; dynamic lighting plays no part online.
_Avoid_: session view, player mode

**Player profile**:
Someone at the table, as the GM lists them in a collection's settings (Players tab): a name and a colour, no password. A player picks one on opening the player client; the browser remembers it per collection.
_Avoid_: account, user, login

**Player-controlled token**:
A token the GM has given to one or more player profiles (Edit Token, or the token menu's Players). Only a player client that chose one of those profiles can act on it; a token given to nobody is the GM's alone.
_Avoid_: owned token, player token

**Held token**:
A token someone is dragging. While a player holds it, nobody else can take it, and everyone sees it move.
_Avoid_: locked token, grabbed token

**Player command**:
A request from a player client to change the scene (move, change a resource, set a condition, roll, rotate). The GM's Atlas applies it at once, and only to tokens given to the profile the client chose. The GM's undo never takes it back.
_Avoid_: action, edit, event
