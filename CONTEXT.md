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

**Character**:
A token of a collection's library, and every placement of it on any map (recognised by its artwork). Its settings (players, nameplate, ring, size, vision, light, side, maxima set by hand, linked, who sees its bars) are the same on every map: changing them on one placement changes them on all.
_Avoid_: actor, prototype

**Linked character**:
A character whose resources and conditions are also the same on every map (player characters, important NPCs). An unlinked character's (a goblin's) belong to each placement.
_Avoid_: unique token, PC token

**Held token**:
A token someone is dragging. While a player holds it, nobody else can take it, and everyone sees it move.
_Avoid_: locked token, grabbed token

**Player command**:
A request from a player client to change the scene (move, change a resource, set a condition, roll, rotate). The GM's Atlas applies it at once, and only to tokens given to the profile the client chose. The GM's undo never takes it back.
_Avoid_: action, edit, event

## Collections

**Game system**:
The named set of rules a collection follows (how the ruler measures, which conditions, senses, dice, resources and initiative it has). Built-in ones ship with Atlas; the GM's own are saved from a collection's rules and shared by every collection of the vault. Choosing one replaces the collection's rules; changing a rule afterwards leaves the collection on that game system, marked as edited.
_Avoid_: preset (in the UI), ruleset, template

**Collection settings**:
The rules and choices of one collection, edited in its settings dialog, one tab per area (dice, grid and measurement, conditions…). The game system is chosen above the tabs, not in one of them, since it sets what the tabs hold.
_Avoid_: default settings, preferences
