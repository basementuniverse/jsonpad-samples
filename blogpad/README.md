# BlogPad

This is a demo app for [jsonpad.io](https://jsonpad.io).

Check out the live demo here: https://basementuniverse.github.io/jsonpad-samples/blogpad/

It's a simple blogging platform which allows users to register, create articles, edit and delete them.

Everyone can read articles, but only the user who created an article can edit or delete it.

The app uses Vue.js and the JSONPad SDK. It was mostly generated using cursor with a bit of tweaking to tidy up and add styling.

## How to run it

This is pure frontend! Literally 100% of the backend functionality is provided by jsonpad.io.

So you don't need any infrastructure, servers or databases or anything like that; just open the `index.html` file in your browser.

## How to set this up from scratch

If you want to set up your own version of this app:

1. create a [JSONPad account](https://jsonpad.io/register)
2. create a list called "Blogpad Articles" with the path name `blogpad-articles`
3. create a token called "Blogpad Token", then use the dashboard to set up the following permissions, making sure to paste in the id of your "Blogpad Articles" list:

(alternatively you can just adapt and paste in the following JSON...)

```json
[
  {
    "mode": "allow",
    "action": "view",
    "listIds": [
      "39f06cd2-ab92-4d82-ae4c-c62a38ec505a"
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
      "39f06cd2-ab92-4d82-ae4c-c62a38ec505a"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "register",
    "groups": [
      "blogpad"
    ],
    "resourceType": "identity"
  },
  {
    "mode": "allow",
    "action": "authenticate",
    "groups": [
      "blogpad"
    ],
    "resourceType": "identity"
  },
  {
    "mode": "allow",
    "action": "create-with-identity",
    "listIds": [
      "39f06cd2-ab92-4d82-ae4c-c62a38ec505a"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "update-with-identity",
    "itemIds": [
      "*"
    ],
    "listIds": [
      "39f06cd2-ab92-4d82-ae4c-c62a38ec505a"
    ],
    "resourceType": "item"
  },
  {
    "mode": "allow",
    "action": "delete-with-identity",
    "itemIds": [
      "*"
    ],
    "listIds": [
      "39f06cd2-ab92-4d82-ae4c-c62a38ec505a"
    ],
    "resourceType": "item"
  }
]
```

5. once you've created the token, copy the token value and paste it into `app.js` where we construct the JSONPad SDK instance (line ~7)
