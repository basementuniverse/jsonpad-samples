# Notice Board

This is a demo app for [jsonpad.io](https://jsonpad.io).

Check out the live demo here: https://basementuniverse.github.io/jsonpad-samples/noticeboard/

Click on the screen to add a notice at that location, then edit or delete notices.

Changes will be synced to everyone in realtime.

## How to run it

Simply open the `index.html` file in your browser.

## How to set this up from scratch

If you want to set up your own version of this app:

1. create a [JSONPad account](https://jsonpad.io/register)
2. create a list called "Notice Board Notices" with the path name `notice-board-notices`
3. create a token called "Notice Board Token", then use the dashboard to set up the following permissions, making sure to paste in the id of your "Notice Board Notices" list:

(alternatively you can just adapt and paste in the following JSON...)

```json
[
  {
    "mode": "allow",
    "action": "view",
    "listIds": [
      "b7195be9-46a6-4427-b54e-bf99c8dae056"
    ],
    "resourceType": "list"
  },
  {
    "mode": "allow",
    "action": "view",
    "itemIds": [
      "*"
    ],
    "listIds": [
      "b7195be9-46a6-4427-b54e-bf99c8dae056"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "create",
    "listIds": [
      "b7195be9-46a6-4427-b54e-bf99c8dae056"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "update",
    "itemIds": [
      "*"
    ],
    "listIds": [
      "b7195be9-46a6-4427-b54e-bf99c8dae056"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "delete",
    "itemIds": [
      "*"
    ],
    "listIds": [
      "b7195be9-46a6-4427-b54e-bf99c8dae056"
    ],
    "resourceType": "item"
  }
]
```

5. once you've created the token, copy the token value, list path name, and list id into `app.js` (the constants in the top 3 lines) 
