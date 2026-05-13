# Fortnite Discord Bot

A full-featured Fortnite Discord bot — single file, no monorepo, Railway/Windows compatible.

## Setup

1. Copy `.env.example` to `.env` and fill in your values
2. `npm install`
3. `npm start`

Commands register automatically on startup.

## Commands

| Command | Description |
|---|---|
| `/setup` | (Admin) Set the spawn channel |
| `/forcespawn` | (Admin) Force spawn a skin/item in the channel |
| `/givespawn` | (Admin) Give any item directly to your inventory |
| `/hack` | (Admin) Give 13,500 V-Bucks to a player |
| `/resetshop` | (Admin) Force reset the Item Shop |
| `/vbucks` | Check your V-Bucks balance |
| `/daily` | Claim daily V-Bucks (streak bonuses!) |
| `/inventory` | View skins, items, luck status |
| `/itemshop` | Browse the Item Shop with pagination |
| `/buy` | Purchase a skin from the Item Shop |
| `/gift` | Gift a skin to another player |
| `/trade` | Offer a skin trade with another player |
| `/refund` | Request a refund (67% Epic rejection rate) |
| `/coinflip` | Challenge someone to a V-Bucks coin flip |
| `/attack` | Attack a player with a weapon |
| `/reboot` | Reboot an eliminated player (299 V-Bucks) |
| `/savetheworld` | View STW quests, level up, open boxes |
| `/founderspack` | Get easy Founders Pack quests (separate system) |
| `/completefoundersquests` | Turn in Founders Pack quests for boxes |
| `/founderpack` | Open Founders Boxes (with God Chest chance!) |
| `/opengodchest` | Open a God Chest from inventory |
| `/openmysterious` | Open a Mysterious Chest from inventory |
| `/useluckpotion` | Activate a luck potion |
| `/spawn` | Spawn luck potions or founders boxes |
| `/zeropoint` | Interact with the Zero Point orb |
| `/creatorcode` | Support a creator for discounts |
| `/leaderboard` | Top players by skins, V-Bucks, or level |
| `/achievements` | View your achievement progress |
| `/skinalogue` | Browse all catchable skins |
| `/freevbucks` | "Free V-Bucks" (totally not a scam) |

## Chest System

### Founders Box → God Chest (5% base)
| Luck | God Chest Chance |
|---|---|
| None | 5% |
| 🍀 Normal (+15%) | 20% |
| 🔮 Xtra (+40%) | 45% |
| ⚡ Godly (+80%) | 85% |

### God Chest (Gold 🌟)
- 25% → 🔵 Mysterious Chest
- 25% → 1,000 V-Bucks
- 50% → Nothing

### Mysterious Chest (Blue 🔵)
- 15% → **INFINITE V-Bucks** (never goes down)
- 25% → 10,000 V-Bucks
- 60% → 1,000 V-Bucks

### Zero Point Luck Upgrades
- Feed Luck Potion → **50%** chance for Xtra Luck Potion
- Feed Xtra Luck Potion → **25%** chance for Godly Luck Potion

### Godly Luck Potions
Only obtainable via `/givespawn` (admin) or Zero Point upgrade.

## Spawn System
Type `buy` in the spawn channel to claim spawned items:
- Skins (random rarity weighted)
- V-Bucks drops (1,000)
- STW Packs (5 boxes)
- Founders Pack (unlocks founder system)
- Founders Boxes
- Luck Potions & Xtra Luck Potions

## Express Endpoints (Railway health)
- `GET /check` — health check
- `POST /give` — add to in-memory rewards store

## Environment Variables
```
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=optional_for_faster_dev_registration
PORT=3000
```

## Railway Deployment
1. Push folder to GitHub
2. Connect to Railway — auto-detects `npm start`
3. Set env vars in Railway dashboard
