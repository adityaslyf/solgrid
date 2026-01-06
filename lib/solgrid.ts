/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solgrid.json`.
 */
export type Solgrid = {
  "address": "Hk6wh6upkJ8AgNFbvNzYJnPpZCu23WRy5TQTse1qRxzL",
  "metadata": {
    "name": "solgrid",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeGame",
      "discriminator": [
        44,
        62,
        102,
        247,
        126,
        208,
        130,
        215
      ],
      "accounts": [
        {
          "name": "playerOne",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "string"
        }
      ]
    },
    {
      "name": "joinGame",
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "playerTwo",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "gameId",
          "type": "string"
        }
      ]
    },
    {
      "name": "makeMove",
      "discriminator": [
        78,
        77,
        152,
        203,
        222,
        211,
        208,
        233
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "moveId",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notYourTurn",
      "msg": "It is not your turn."
    },
    {
      "code": 6001,
      "name": "gameNotActive",
      "msg": "The game is not active."
    },
    {
      "code": 6002,
      "name": "moveAlreadyMade",
      "msg": "This move has already been made."
    },
    {
      "code": 6003,
      "name": "gameAlreadyStarted",
      "msg": "Game already started."
    },
    {
      "code": 6004,
      "name": "cannotPlayAgainstSelf",
      "msg": "Cannot play against yourself (in P2P mode)."
    }
  ],
  "types": [
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "playerOne",
            "type": "pubkey"
          },
          {
            "name": "playerTwo",
            "type": "pubkey"
          },
          {
            "name": "currentTurn",
            "type": "pubkey"
          },
          {
            "name": "turnCount",
            "type": "u16"
          },
          {
            "name": "gameStatus",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "gameId",
            "type": "string"
          },
          {
            "name": "boardState",
            "type": {
              "vec": "string"
            }
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingForOpponent"
          },
          {
            "name": "active"
          },
          {
            "name": "finished"
          }
        ]
      }
    }
  ]
};
