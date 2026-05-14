require("dotenv").config();

const {
  Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ComponentType, PermissionFlagsBits,
  ChannelType, REST, Routes,
} = require("discord.js");

const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
app.use("/skins", express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
app.get("/check", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.listen(PORT, () => console.log(`Express server on port ${PORT}`));

// ─────────────────────────────────────────────
//  Constants / Images
// ─────────────────────────────────────────────
const VBUCKS_IMAGE   = "https://fortnite-api.com/images/vbuck.png";
const FP_PACK_IMAGE  = "https://static.wikia.nocookie.net/fortnite/images/4/4d/Founders_Pack_-_Icon.png";
const FP_BOX_IMAGE   = "https://static.wikia.nocookie.net/fortnite/images/9/98/Llama-_Standard.png";
const STW_LOGO_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/a/a3/Save_the_World_-_Logo.png";
const LUCK_POT_IMG   = "https://static.wikia.nocookie.net/fortnite/images/f/f2/Slurp_Juice_-_Consumable_-_Fortnite.png";
const ZERO_PT_IMAGE  = "https://static.wikia.nocookie.net/fortnite/images/a/a5/Zero_Point.png";
const LLAMA_IMAGE    = "https://static.wikia.nocookie.net/fortnite/images/9/98/Llama-_Standard.png";
const SUPPLY_IMAGE   = "https://static.wikia.nocookie.net/fortnite/images/b/b6/Supply_Drop_-_Default_-_Fortnite.png";
const BUS_IMAGE      = "https://static.wikia.nocookie.net/fortnite/images/7/70/Battle_Bus_%28V10.40%29.png";

const SHOP_RESET_MS = 24 * 60 * 60 * 1000;
const SKIN_PRICE    = 1500;

// ─────────────────────────────────────────────
//  Fortnite data
// ─────────────────────────────────────────────
const FORTNITE_WEAPONS = [
  { id: "pump_shotgun",     name: "Pump Shotgun",            emoji: "🔫", type: "shotgun",   description: "One pump — if it lands."              },
  { id: "heavy_sniper",     name: "Heavy Sniper Rifle",       emoji: "🎯", type: "sniper",    description: "Walls? What walls?"                   },
  { id: "scar",             name: "SCAR",                     emoji: "⚡", type: "ar",        description: "The gold standard of ARs."            },
  { id: "rocket_launcher",  name: "Rocket Launcher",          emoji: "🚀", type: "explosive", description: "Shoot first, aim never."              },
  { id: "bolt_sniper",      name: "Bolt-Action Sniper Rifle", emoji: "🎯", type: "sniper",    description: "Patience is a virtue."                },
  { id: "hand_cannon",      name: "Hand Cannon",              emoji: "🔫", type: "pistol",    description: "A pistol with stopping power."        },
  { id: "combat_shotgun",   name: "Combat Shotgun",           emoji: "💥", type: "shotgun",   description: "Fast fire, no mercy."                 },
  { id: "grenade_launcher", name: "Grenade Launcher",         emoji: "💣", type: "explosive", description: "Indirect fire specialist."            },
  { id: "pump_shotgun",     name: "Pump Shotgun",            emoji: "🔫", type: "shotgun",   description: "One pump — if it lands."              },
  { id: "heavy_sniper",     name: "Heavy Sniper Rifle",       emoji: "🎯", type: "sniper",    description: "Walls? What walls?"                   },
  { id: "scar",             name: "SCAR",                     emoji: "⚡", type: "ar",        description: "The gold standard of ARs."            },
  { id: "rocket_launcher",  name: "Rocket Launcher",          emoji: "🚀", type: "explosive", description: "Shoot first, aim never."              },
  { id: "bolt_sniper",      name: "Bolt-Action Sniper Rifle", emoji: "🎯", type: "sniper",    description: "Patience is a virtue."                },
  { id: "hand_cannon",      name: "Hand Cannon",              emoji: "🔫", type: "pistol",    description: "A pistol with stopping power."        },
  { id: "combat_shotgun",   name: "Combat Shotgun",           emoji: "💥", type: "shotgun",   description: "Fast fire, no mercy."                 },
  { id: "grenade_launcher", name: "Grenade Launcher",         emoji: "💣", type: "explosive", description: "Indirect fire specialist."            },
  { id: "stinger_smg",      name: "Stinger SMG",              emoji: "⚡", type: "smg",       description: "Up close and very personal."          },
  { id: "thermal_scoped",   name: "Thermal Scoped AR",        emoji: "🔭", type: "ar",        description: "Nobody hides from this."              },
  { id: "rapid_fire_smg",   name: "Rapid Fire SMG",           emoji: "💨", type: "smg",       description: "Half the accuracy, twice the panic."  },
  { id: "mythic_goldfish",  name: "Mythic Goldfish",           emoji: "🐟", type: "special",   description: "It's a fish. A very powerful fish."  },
  { id: "flint_knock",      name: "Flintlock Pistol",         emoji: "🔫", type: "pistol",    description: "Knocks them back to the Stone Age."  },
  { id: "minigun",          name: "Minigun",                  emoji: "🔥", type: "ar",        description: "Sustained fire destroyer."            },
  { id: "shockwave_launcher", name: "Shockwave Launcher",     emoji: "💫", type: "explosive", description: "Not lethal. Just humiliating."        },
];
const MULTI_AMMO_TYPES = new Set(["smg", "ar"]);
function isMultiAmmoWeapon(w) { return MULTI_AMMO_TYPES.has(w.type); }
function getWeaponByName(name) {
  const q = name.toLowerCase().trim();
  return FORTNITE_WEAPONS.find((w) => w.name.toLowerCase() === q || w.id === q || w.name.toLowerCase().includes(q));
}
function randomWeapon() { return FORTNITE_WEAPONS[Math.floor(Math.random() * FORTNITE_WEAPONS.length)]; }

const RARITY_WEIGHTS = { legendary: 5, epic: 10, rare: 20, uncommon: 30, common: 35 };

// Fishing spots + results
const FISH_SPOTS = ["Pleasant Park", "Lazy Lake", "Tilted Towers", "Slurpy Swamp", "Misty Meadows", "Coral Castle", "Holly Hatchery", "Dirty Docks", "Steamy Stacks"];
const FISH_TABLE = [
  { name: "Small Fry",      emoji: "🐟", weight: 30, action: (uid) => { addXP(uid, 75); return "A tiny **Small Fry**! +75 XP"; } },
  { name: "Flopper",        emoji: "🐠", weight: 25, action: (uid) => { addVbucks(uid, 200); return "A **Flopper**! +200 V-Bucks"; } },
  { name: "Slurpfish",      emoji: "🐡", weight: 15, action: (uid) => { addXP(uid, 200); addVbucks(uid, 100); return "A **Slurpfish**! +200 XP + 100 V-Bucks"; } },
  { name: "Shield Fish",    emoji: "🛡️", weight: 10, action: (uid) => { const u = getUser(uid); updateUser(uid, { buildCharges: (u.buildCharges||0)+1, buildMaterial: u.buildMaterial==="none" ? "wood" : u.buildMaterial }); return "A **Shield Fish**! +1 build charge to your structure"; } },
  { name: "Mythic Goldfish", emoji: "✨", weight: 3,  action: (uid) => { const u = getUser(uid); updateUser(uid, { weapons: [...(u.weapons||[]), "Mythic Goldfish"] }); return "✨ **THE MYTHIC GOLDFISH!** A legendary weapon added to your arsenal!"; } },
  { name: "Junk",           emoji: "🗑️", weight: 12, action: (uid) => { addVbucks(uid, -50); return "Junk! You lost 50 V-Bucks pulling it out"; } },
  { name: "Supply Chest",   emoji: "📦", weight: 5,  action: (uid) => { const u = getUser(uid); updateUser(uid, { boxes: (u.boxes||0)+1 }); return "A **Supply Chest** underwater! +1 STW Box"; } },
];
function weightedFish() {
  const total = FISH_TABLE.reduce((a,b) => a+b.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH_TABLE) { r -= f.weight; if (r <= 0) return f; }
  return FISH_TABLE[0];
}

// Battle Bus drop locations
const DROP_LOCATIONS = [
  { name: "Tilted Towers",    emoji: "🏙️", bonus: "hotspot",  desc: "Hot drop! Contested. High risk, high reward." },
  { name: "Pleasant Park",    emoji: "🏘️", bonus: "xp",       desc: "Chill suburban vibes. Good XP gains."          },
  { name: "Lazy Lake",        emoji: "🏞️", bonus: "vbucks",   desc: "A quiet lake town hiding V-Bucks."             },
  { name: "Slurpy Swamp",     emoji: "🌿", bonus: "heal",     desc: "Healing waters flow here."                     },
  { name: "Steamy Stacks",    emoji: "🏭", bonus: "weapon",   desc: "Industrial zone. Weapons everywhere."          },
  { name: "Holly Hatchery",   emoji: "🌲", bonus: "sneak",    desc: "Dense cover. Sneaky plays."                    },
  { name: "Coral Castle",     emoji: "🐚", bonus: "special",  desc: "Mysterious underwater ruins."                  },
  { name: "Dirty Docks",      emoji: "⚓", bonus: "vbucks",   desc: "Shipping containers full of loot."             },
  { name: "Sweaty Sands",     emoji: "🏖️", bonus: "llama",    desc: "Llamas spotted on the beach!"                 },
];

// Named POIs for flavor
const FORTNITE_POIS = ["Tilted Towers","Pleasant Park","Lazy Lake","Slurpy Swamp","Retail Row","Misty Meadows","Steamy Stacks","Coral Castle","Holly Hatchery","Dirty Docks","Sweaty Sands","Craggy Cliffs","Catty Corner","Stark Industries","Authority"];

// Build materials
const BUILD_MATS = {
  wood:  { label: "🪵 Wood",  cost: 50,  charges: 1, desc: "Basic protection. Blocks 1 hit." },
  brick: { label: "🧱 Brick", cost: 125, charges: 2, desc: "Sturdy. Blocks 2 hits."          },
  metal: { label: "⚙️ Metal", cost: 250, charges: 3, desc: "Maximum defense. Blocks 3 hits." },
};

// Storm events
const STORM_EVENTS = [
  { name: "Safe Zone 🟢",     chance: 35, color: 0x00ff00, fn: (uid) => { addXP(uid, 100); return "You're in the **safe zone**! +100 XP"; } },
  { name: "Storm Edge ⚠️",   chance: 25, color: 0xffaa00, fn: (uid) => { addVbucks(uid, -100); return "You're on the **storm edge**! -100 V-Bucks taken by storm damage"; } },
  { name: "Eye of Storm ⭐",  chance: 15, color: 0xf4a01a, fn: (uid) => { addVbucks(uid, 500); addXP(uid, 200); return "You found the **Eye of the Storm**! +500 V-Bucks + 200 XP!"; } },
  { name: "In the Storm ☠️", chance: 20, color: 0xff0000, fn: (uid) => { addVbucks(uid, -250); return "You're deep **inside the storm**! -250 V-Bucks from storm damage"; } },
  { name: "Storm Surge ⚡",   chance: 5,  color: 0x9b4dca, fn: (uid) => { updateUser(uid, { eliminatedUntil: Date.now() + 3 * 60 * 1000 }); return "**Storm surge!** You were knocked down! Eliminated for 3 minutes"; } },
];
function rollStorm() {
  const total = STORM_EVENTS.reduce((a,b) => a+b.chance, 0);
  let r = Math.random() * total;
  for (const e of STORM_EVENTS) { r -= e.chance; if (r <= 0) return e; }
  return STORM_EVENTS[0];
}

// Battle Pass tiers
function getBattlePassTier(level, xp) {
  return Math.min(100, Math.floor(level * 2 + xp / 300));
}
const BP_REWARDS = [
  { tier: 5,   reward: "🎒 Spray: No Sweat"       },
  { tier: 10,  reward: "💃 Emote: Floss"           },
  { tier: 15,  reward: "🎒 Back Bling: Shield Can" },
  { tier: 20,  reward: "🔫 Wrap: Tiger"            },
  { tier: 30,  reward: "🎮 Loading Screen"         },
  { tier: 40,  reward: "👟 Contrail: Hearts"       },
  { tier: 50,  reward: "🌟 Outfit: Midas"          },
  { tier: 60,  reward: "🎭 Emote: On The Hook"     },
  { tier: 75,  reward: "💎 Glider: Midas' Drum"   },
  { tier: 100, reward: "👑 Full Gold Midas Skin!"  },
];

// Creator codes
const VALID_CODES = {
  tylajadee: { displayName: "Tylajadee", discount: 0.1, freeSkin: true },
  qckdream:  { displayName: "Qckdream",  discount: 0.1 },
  clovel:    { displayName: "Clovel",    discount: 0.2 },
};

// ─────────────────────────────────────────────
//  In-memory storage
// ─────────────────────────────────────────────
const DAILY_QUESTS = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",            xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                  xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",             xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",       xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];
function freshQuests() { return DAILY_QUESTS.map((q) => ({ ...q, current: 0, completed: false })); }

const FOUNDERS_QUEST_POOL = [
  { id: "catch_skins_3",  label: "Catch 3 skins from the spawn channel",   stat: "spawnCatches",    required: 3    },
  { id: "catch_skins_5",  label: "Catch 5 skins from the spawn channel",   stat: "spawnCatches",    required: 5    },
  { id: "win_flip_1",     label: "Win 1 coin flip",                         stat: "coinflipsWon",    required: 1    },
  { id: "win_flip_3",     label: "Win 3 coin flips",                        stat: "coinflipsWon",    required: 3    },
  { id: "buy_shop_1",     label: "Buy a skin from the Item Shop",           stat: "shopPurchases",   required: 1    },
  { id: "buy_shop_2",     label: "Buy 2 skins from the Item Shop",          stat: "shopPurchases",   required: 2    },
  { id: "open_stw",       label: "Open 1 Save the World Box",               stat: "boxesOpened",     required: 1    },
  { id: "daily_claim",    label: "Claim your daily reward",                 stat: "dailyStreak",     required: 1    },
  { id: "use_zeropoint",  label: "Use the /zeropoint command",              stat: "zeropointUses",   required: 1    },
  { id: "trade_skin",     label: "Complete a skin trade with someone",      stat: "tradesCompleted", required: 1    },
  { id: "gift_skin",      label: "Gift a skin to another player",           stat: "giftsGiven",      required: 1    },
  { id: "play_flip",      label: "Challenge someone to a coin flip",        stat: "coinflipsPlayed", required: 1    },
  { id: "earn_xp_300",    label: "Earn 300 XP on the bot",                  stat: "xp",              required: 300  },
  { id: "earn_xp_1000",   label: "Earn 1,000 XP on the bot",               stat: "xp",              required: 1000 },
  { id: "check_vbucks_5", label: "Check your V-Bucks 5 times",              stat: "vbucksChecked",   required: 5    },
  { id: "catch_10",       label: "Catch 10 items from the spawn channel",   stat: "spawnCatches",    required: 10   },
  { id: "level_3",        label: "Reach Level 3 on the bot",                stat: "level",           required: 3    },
  { id: "level_5",        label: "Reach Level 5 on the bot",                stat: "level",           required: 5    },
  { id: "open_llama",     label: "Open a Supply Llama",                     stat: "llamaOpens",      required: 1    },
  { id: "go_fishing",     label: "Catch something while fishing",           stat: "fishCaught",      required: 1    },
  { id: "survive_storm",  label: "Survive the storm 3 times",               stat: "stormsSurvived",  required: 3    },
  { id: "supply_drop_1",  label: "Call in a supply drop",                   stat: "supplyDrops",     required: 1    },
  { id: "duel_someone",   label: "Challenge someone to a duel",             stat: "duelsPlayed",     required: 1    },
  { id: "build_up",       label: "Build a structure for protection",        stat: "timesBuilt",      required: 1    },
];

function pickRandom(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }

function assignFoundersQuests(userId) {
  const user = getUser(userId);
  const pool = pickRandom(FOUNDERS_QUEST_POOL, 3);
  const quests = pool.map((q) => ({ ...q, baseline: user[q.stat] ?? 0, awardedBox: false }));
  updateUser(userId, { foundersQuestPending: quests });
  return quests;
}

function checkFoundersQuests(userId) {
  const user = getUser(userId);
  if (!user.foundersQuestPending?.length) return { newBoxes: 0, quests: [] };
  let newBoxes = 0;
  const updated = user.foundersQuestPending.map((q) => {
    if (q.awardedBox) return q;
    const current = (user[q.stat] ?? 0) - (q.baseline ?? 0);
    const done = current >= q.required;
    if (done) newBoxes++;
    return { ...q, awardedBox: done };
  });
  if (newBoxes > 0) updateUser(userId, { foundersQuestPending: updated, foundersBoxes: (user.foundersBoxes ?? 0) + newBoxes });
  else updateUser(userId, { foundersQuestPending: updated });
  return { newBoxes, quests: updated };
}

const _data = { config: { guildSpawnChannels: {} }, users: {}, itemShop: { skins: [], lastReset: 0 }, coinflipChallenges: {} };

function getUser(userId) {
  if (!_data.users[userId]) _data.users[userId] = {
    vbucks: 500, inventory: [], inventoryNames: {}, xp: 0, level: 1,
    interactionCount: 0, boxes: 0, quests: freshQuests(), lastQuestReset: Date.now(),
    lastDailyClaim: 0, dailyStreak: 0, achievementsEarned: [],
    coinflipsWon: 0, coinflipsPlayed: 0, boxesOpened: 0, giftsGiven: 0,
    tradesCompleted: 0, shopPurchases: 0, shopSkins: [], shopSkinPrices: {},
    brokeAttempt: false, refundCooldowns: {}, hasCreatorCode: false, creatorDiscount: 0,
    hasFoundersPack: false, foundersBoxes: 0, foundersBoxesOpened: 0,
    freeSkinExpiry: 0, freeSkinRedeemed: false, freeSkinIds: [],
    eliminatedUntil: 0, weapons: [],
    spawnCatches: 0, zeropointUses: 0, vbucksChecked: 0,
    luckPotion: 0, xtraLuckPotion: 0, godlyLuckPotion: 0,
    activeLuck: "none", infiniteVbucks: false,
    godChest: 0, mysteriousChest: 0,
    foundersQuestPending: [],
    llamaOpens: 0, fishCaught: 0, stormsSurvived: 0, supplyDrops: 0,
    duelsPlayed: 0, timesBuilt: 0,
    lastLlama: 0, lastSupplyDrop: 0, lastFish: 0, lastStorm: 0,
    buildCharges: 0, buildMaterial: "none",
  };
  const u = _data.users[userId];
  const defaults = {
    achievementsEarned: [], shopSkins: [], shopSkinPrices: {}, refundCooldowns: {},
    weapons: [], foundersQuestPending: [], freeSkinIds: [],
    luckPotion: 0, xtraLuckPotion: 0, godlyLuckPotion: 0, activeLuck: "none",
    infiniteVbucks: false, godChest: 0, mysteriousChest: 0,
    spawnCatches: 0, zeropointUses: 0, vbucksChecked: 0, coinflipsPlayed: 0,
    llamaOpens: 0, fishCaught: 0, stormsSurvived: 0, supplyDrops: 0,
    duelsPlayed: 0, timesBuilt: 0,
    lastLlama: 0, lastSupplyDrop: 0, lastFish: 0, lastStorm: 0,
    buildCharges: 0, buildMaterial: "none",
  };
  for (const [k, v] of Object.entries(defaults)) { if (u[k] === undefined) u[k] = v; }
  return u;
}

function updateUser(userId, update) {
  const user = getUser(userId);
  Object.assign(user, update);
  _data.users[userId] = user;
}

function addInteraction(userId) {
  const user = getUser(userId);
  user.interactionCount += 1;
  const gained = user.interactionCount % 30 === 0;
  if (gained && !user.infiniteVbucks) user.vbucks += 250;
  return { gainedVbucks: gained };
}

function addVbucks(userId, amount) {
  const u = getUser(userId);
  if (u.infiniteVbucks && amount < 0) return;
  u.vbucks += amount;
}

function addSkinToInventory(userId, skinId, skinName) {
  const u = getUser(userId);
  u.inventory.push(skinId);
  u.inventoryNames[skinId + "_" + u.inventory.length] = skinName;
}

function xpForLevel(level) { return Math.min(100 * level, 450); }
function calculateLevelFromXP(totalXp) {
  let level = 1, remaining = totalXp;
  while (true) {
    const needed = xpForLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpForNext: needed };
    remaining -= needed; level++;
  }
}
function addXP(userId, amount) {
  const u = getUser(userId);
  const before = calculateLevelFromXP(u.xp);
  u.xp += amount;
  const after = calculateLevelFromXP(u.xp);
  const leveledUp = after.level > before.level;
  u.level = after.level;
  if (leveledUp) u.boxes += after.level - before.level;
  return { leveledUp, newLevel: after.level };
}

function resetQuestsIfNeeded(userId) {
  const u = getUser(userId);
  if (Date.now() - u.lastQuestReset > 24 * 60 * 60 * 1000) {
    u.quests = freshQuests(); u.lastQuestReset = Date.now();
  }
}

function progressQuest(userId, questId, amount = 1) {
  resetQuestsIfNeeded(userId);
  const u = getUser(userId);
  const quest = u.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;
  quest.current = Math.min(quest.current + amount, quest.required);
  if (quest.current >= quest.required) {
    quest.completed = true;
    addXP(userId, quest.xpReward);
    u.foundersBoxes = (u.foundersBoxes ?? 0) + 1;
  }
  return quest.completed ? quest : null;
}

function isEliminated(userId) { return (getUser(userId).eliminatedUntil ?? 0) > Date.now(); }
function getEliminationTimeLeft(userId) { return Math.max(0, (getUser(userId).eliminatedUntil ?? 0) - Date.now()); }
function hasActiveFreeSkin(userId) { const u = getUser(userId); return (u.freeSkinExpiry ?? 0) > Date.now() && !(u.freeSkinRedeemed ?? false); }
function getItemShop() { return _data.itemShop; }
function setItemShop(skins) { _data.itemShop = { skins, lastReset: Date.now() }; }
function getSpawnChannel(guildId) { return _data.config.guildSpawnChannels[guildId]; }
function setSpawnChannel(guildId, channelId) { _data.config.guildSpawnChannels[guildId] = channelId; }
function getAllGuildSpawnChannels() { return _data.config.guildSpawnChannels; }
function getAllUsers() { return _data.users; }
function setCoinflipChallenge(id, ch) { _data.coinflipChallenges[id] = ch; }
function getCoinflipChallenge(id) { return _data.coinflipChallenges[id]; }
function deleteCoinflipChallenge(id) { delete _data.coinflipChallenges[id]; }

// ─────────────────────────────────────────────
//  Luck helpers
// ─────────────────────────────────────────────
const LUCK_BOOST = { none: 0, normal: 15, xtra: 40, godly: 80 };
function boostedChance(base, luck) { return Math.min(base + (LUCK_BOOST[luck] || 0), 99); }
function roll(pct) { return Math.random() * 100 < pct; }

// ─────────────────────────────────────────────
//  Achievements
// ─────────────────────────────────────────────
const ALL_ACHIEVEMENTS = [
  { id: "first_catch",      title: "First Catch",                  emoji: "🎮", description: "Catch your first spawned skin",                   check: (u) => u.inventory.length >= 1 },
  { id: "collector",        title: "Collector",                    emoji: "🎒", description: "Own 10 skins",                                    check: (u) => u.inventory.length >= 10 },
  { id: "hoarder",          title: "Hoarder",                      emoji: "📦", description: "Own 50 skins",                                    check: (u) => u.inventory.length >= 50 },
  { id: "shop_regular",     title: "Shop Regular",                 emoji: "🛒", description: "Buy a skin from the Item Shop",                   check: (u) => (u.shopPurchases ?? 0) >= 1 },
  { id: "big_spender",      title: "Big Spender",                  emoji: "💸", description: "Buy 5 skins from the Item Shop",                  check: (u) => (u.shopPurchases ?? 0) >= 5 },
  { id: "generous",         title: "Generous",                     emoji: "🎁", description: "Gift a skin to another player",                   check: (u) => (u.giftsGiven ?? 0) >= 1 },
  { id: "trader",           title: "Trader",                       emoji: "🔄", description: "Complete a skin trade",                           check: (u) => (u.tradesCompleted ?? 0) >= 1 },
  { id: "lucky_flip",       title: "Lucky Flip",                   emoji: "🪙", description: "Win a coin flip",                                 check: (u) => (u.coinflipsWon ?? 0) >= 1 },
  { id: "flip_master",      title: "Flip Master",                  emoji: "🎰", description: "Win 10 coin flips",                               check: (u) => (u.coinflipsWon ?? 0) >= 10 },
  { id: "box_opener",       title: "Box Opener",                   emoji: "📬", description: "Open a Save the World Box",                       check: (u) => (u.boxesOpened ?? 0) >= 1 },
  { id: "stw_devotee",      title: "STW Devotee",                  emoji: "⚡", description: "Open 10 Save the World Boxes",                    check: (u) => (u.boxesOpened ?? 0) >= 10 },
  { id: "streak_starter",   title: "Streak Starter",               emoji: "🔥", description: "3-day daily streak",                              check: (u) => (u.dailyStreak ?? 0) >= 3 },
  { id: "on_fire",          title: "On Fire",                      emoji: "🌋", description: "7-day daily streak",                              check: (u) => (u.dailyStreak ?? 0) >= 7 },
  { id: "unstoppable",      title: "Unstoppable",                  emoji: "👑", description: "30-day daily streak",                             check: (u) => (u.dailyStreak ?? 0) >= 30 },
  { id: "level_5",          title: "Rising Star",                  emoji: "⭐", description: "Reach Level 5",                                  check: (u) => u.level >= 5 },
  { id: "level_10",         title: "Veteran",                      emoji: "🌟", description: "Reach Level 10",                                  check: (u) => u.level >= 10 },
  { id: "level_25",         title: "Legend",                       emoji: "💫", description: "Reach Level 25",                                  check: (u) => u.level >= 25 },
  { id: "wealthy",          title: "Wealthy",                      emoji: "💰", description: "Hold 5,000 V-Bucks at once",                      check: (u) => u.vbucks >= 5000 },
  { id: "rich",             title: "Rich",                         emoji: "💎", description: "Hold 10,000 V-Bucks at once",                     check: (u) => u.vbucks >= 10000 },
  { id: "broke",            title: "Broke",                        emoji: "🪙", description: "Tried to buy something you can't afford",         check: (u) => u.brokeAttempt === true },
  { id: "scammed",          title: "Scammed",                      emoji: "🤡", description: "Fell for a free vbucks scam",                     check: () => false },
  { id: "epic_likes_you",   title: "Epic Games Likes You",         emoji: "💚", description: "Get a refund approved",                           check: () => false },
  { id: "epic_hates_you",   title: "Epic Games Doesn't Like You", emoji: "💔", description: "Get a refund rejected",                           check: () => false },
  { id: "llama_opener",     title: "Llama Opener",                 emoji: "🦙", description: "Open your first Supply Llama",                    check: (u) => (u.llamaOpens ?? 0) >= 1 },
  { id: "llama_hoarder",    title: "Llama Hoarder",                emoji: "🦙", description: "Open 5 Supply Llamas",                            check: (u) => (u.llamaOpens ?? 0) >= 5 },
  { id: "angler",           title: "Angler",                       emoji: "🎣", description: "Catch your first fish",                           check: (u) => (u.fishCaught ?? 0) >= 1 },
  { id: "master_angler",    title: "Master Angler",                emoji: "🐟", description: "Catch 10 fish",                                   check: (u) => (u.fishCaught ?? 0) >= 10 },
  { id: "goldfish",         title: "It's a Goldfish",              emoji: "✨", description: "Fish up the Mythic Goldfish",                     check: () => false },
  { id: "storm_survivor",   title: "Storm Survivor",               emoji: "🌪️", description: "Survive the storm 5 times",                       check: (u) => (u.stormsSurvived ?? 0) >= 5 },
  { id: "builder",          title: "Builder",                      emoji: "🏗️", description: "Build your first structure",                       check: (u) => (u.timesBuilt ?? 0) >= 1 },
  { id: "master_builder",   title: "Master Builder",               emoji: "🏰", description: "Build 10 structures",                             check: (u) => (u.timesBuilt ?? 0) >= 10 },
  { id: "duel_champion",    title: "Duel Champion",                emoji: "⚔️", description: "Win a duel",                                      check: () => false },
  { id: "battle_pass_100",  title: "Battle Pass Complete",         emoji: "👑", description: "Reach Battle Pass Tier 100",                      check: (u) => getBattlePassTier(u.level, u.xp) >= 100 },
];

function checkAndAwardAchievements(userId) {
  const user = getUser(userId);
  const newlyEarned = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!user.achievementsEarned.includes(ach.id) && ach.check(user)) {
      user.achievementsEarned.push(ach.id);
      newlyEarned.push(ach.title);
    }
  }
  return newlyEarned;
}
function awardAchievement(userId, achId) {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
  if (!ach) return null;
  const user = getUser(userId);
  if (user.achievementsEarned.includes(achId)) return null;
  user.achievementsEarned.push(achId);
  return ach;
}
function buildAchievementEmbed(ach) {
  return new EmbedBuilder().setTitle(`${ach.emoji} Achievement Unlocked!`).setDescription(`**${ach.title}**\n*${ach.description}*`).setColor(0xf4a01a).setTimestamp();
}

// ─────────────────────────────────────────────
//  Custom Skins
// ─────────────────────────────────────────────
const SKIN_BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/skins`
  : `http://localhost:${process.env.PORT || 3000}/skins`;

const CUSTOM_SKINS = [
  // ── Base outfits ──
  {
    id: "custom_megan",
    name: "Megan",
    description: "Your just a gameboy.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/file_00000000c49071f48b40e4646744b881-removebg-preview_1778718263699.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_manon",
    name: "Manon",
    description: "Mano. Not Manon.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/file_00000000b7c8720a84acd8f392c65c4d-removebg-preview_1778718307202.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_lara",
    name: "Lara",
    description: "This aint a debut.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010522_CapCut-removebg-preview_1778718380033.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_daniela",
    name: "Daniela",
    description: "Gnarly.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010604_CapCut-removebg-preview_1778718416766.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_yoonchae",
    name: "Yoonchae",
    description: "Party in the hollywood hills.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010636_CapCut-removebg-preview_1778718453907.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_sophia",
    name: "Sophia",
    description: "If you get a call from Gabriela, hang up.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010728_CapCut-removebg-preview_1778718510528.png`,
    isStw: false, isCustom: true,
  },
  // ── PINKY UP reskins ──
  {
    id: "custom_manon_pinkyup",
    name: "Manon (PINKY UP)",
    description: "It's 6. Not 5.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010847_CapCut-removebg-preview_1778718556495.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_yoonchae_pinkyup",
    name: "Yoonchae (PINKY UP)",
    description: "The only true wisdom is knowing you know nothing.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_011001_CapCut-removebg-preview_1778718594499.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_sophia_pinkyup",
    name: "Sophia (PINKY UP)",
    description: "She's screaming from cloud nine.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_010921_CapCut-removebg-preview_1778718639125.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_lara_pinkyup",
    name: "Lara (PINKY UP)",
    description: "I bet it goes like this.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_011053_CapCut-removebg-preview_1778718690534.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_daniela_pinkyup",
    name: "Daniela (PINKY UP)",
    description: "Us against the world shake and shake in the parking lot.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/Screenshot_20260514_011145_CapCut-removebg-preview_1778718737803.png`,
    isStw: false, isCustom: true,
  },
  {
    id: "custom_megan_pinkyup",
    name: "Megan (PINKY UP)",
    description: "No can touch em if they tried.",
    rarity: "Icon",
    imageUrl: `${SKIN_BASE_URL}/file_00000000c49071f48b40e4646744b881-removebg-preview_1778718263699.png`,
    isStw: false, isCustom: true,
  },
];

// ─────────────────────────────────────────────
//  Skin API
// ─────────────────────────────────────────────
const STW_KEYWORDS = ["robo","kevin","save the world","constructor","ninja","outlander","soldier","commando","striker","ramirez","headhunter","jonesy","penny","dim mak","brawler","dragon","powerhouse","hazard","renegade","urban assault","special forces"];
const KNOWN_STW_IDS = ["CID_028_Athena_Commando_F","CID_029_Athena_Commando_F_Halloween","CID_017_Athena_Commando_M","CID_040_Athena_Commando_M_NinjaBlue"];
let cachedSkins = [], cachedStwSkins = [];

async function fetchFortniteSkins() {
  if (cachedSkins.length > 0) return cachedSkins;
  try {
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br", { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const apiSkins = json.data.filter((s) => {
      if (s.type?.value !== "outfit") return false;
      const name = s.name?.trim();
      if (!name || name === "null" || name === "TBD" || name.toLowerCase().startsWith("tid_")) return false;
      const img = s.images?.featured || s.images?.icon || s.images?.small;
      return img && img.trim() !== "" && img !== "null";
    }).map((s) => {
      const nameLower = s.name.toLowerCase(), descLower = (s.description ?? "").toLowerCase();
      const tags = (s.gameplayTags ?? []).join(" ").toLowerCase();
      const isStw = KNOWN_STW_IDS.includes(s.id) || STW_KEYWORDS.some((k) => nameLower.includes(k) || descLower.includes(k) || tags.includes(k));
      return { id: s.id, name: s.name, description: s.description && s.description !== "null" ? s.description : "A Fortnite outfit.", rarity: s.rarity?.displayValue || "Common", imageUrl: s.images?.featured || s.images?.icon || s.images?.small || "", isStw };
    });
    cachedSkins = [...CUSTOM_SKINS, ...apiSkins];
    cachedStwSkins = cachedSkins.filter((s) => s.isStw);
  } catch (err) {
    console.error("Failed to fetch skins:", err.message);
    cachedSkins = [...CUSTOM_SKINS, { id: "default", name: "Default", description: "A basic outfit.", rarity: "Common", imageUrl: "", isStw: false }];
    cachedStwSkins = [];
  }
  return cachedSkins;
}

function weightedRandom(skins) {
  const weights = skins.map((s) => RARITY_WEIGHTS[s.rarity.toLowerCase()] ?? 15);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < skins.length; i++) { rand -= weights[i]; if (rand <= 0) return skins[i]; }
  return skins[skins.length - 1];
}
async function getRandomSkin() { const s = await fetchFortniteSkins(); return weightedRandom(s); }
async function getStwSkins() { if (cachedStwSkins.length > 0) return cachedStwSkins; await fetchFortniteSkins(); return cachedStwSkins; }
async function getRandomStwSkin() { const s = await getStwSkins(); return s.length ? s[Math.floor(Math.random() * s.length)] : null; }
async function getRandomShopSkins(n = 5) { const s = await fetchFortniteSkins(); return [...s].sort(() => Math.random() - 0.5).slice(0, n); }
async function findSkinByName(query) {
  const skins = await fetchFortniteSkins(), q = query.trim().toLowerCase();
  const exact = skins.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = skins.filter((s) => s.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return partial.find((s) => s.name.toLowerCase().startsWith(q)) ?? partial[0];
  return null;
}

function getRarityColor(rarity) {
  const c = { legendary: 0xf4a01a, epic: 0x9b4dca, rare: 0x0075e3, uncommon: 0x1a9b1a, common: 0x808080, marvel: 0xed1d24, icon: 0x00d4ff, shadow: 0x2c2c2c, slurp: 0x00e5ff, frozen: 0xa8d8ea, lava: 0xff4500, dark: 0x6a0dad };
  return c[rarity.toLowerCase()] ?? 0x808080;
}
function getRarityEmoji(rarity) {
  const e = { legendary: "🟡", epic: "🟣", rare: "🔵", uncommon: "🟢", common: "⚪", marvel: "🔴", icon: "🩵" };
  return e[rarity.toLowerCase()] ?? "⚪";
}
function getSpawnPercent(rarity) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  return (((RARITY_WEIGHTS[rarity.toLowerCase()] ?? 15) / total) * 100).toFixed(1);
}

// ─────────────────────────────────────────────
//  Shop
// ─────────────────────────────────────────────
async function ensureShopFresh() {
  const shop = getItemShop();
  if (shop.skins.length > 0 && Date.now() - shop.lastReset < SHOP_RESET_MS) return shop.skins;
  const skins = await getRandomShopSkins(5);
  const shopSkins = skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: SKIN_PRICE }));
  setItemShop(shopSkins);
  return shopSkins;
}
function getTimeUntilReset() {
  const msLeft = Math.max(0, SHOP_RESET_MS - (Date.now() - getItemShop().lastReset));
  return `${Math.floor(msLeft / 3600000)}h ${Math.floor((msLeft % 3600000) / 60000)}m`;
}

// ─────────────────────────────────────────────
//  Chest openers (internal helpers)
// ─────────────────────────────────────────────
async function openGodChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.godChest <= 0) return interaction.reply({ content: "❌ You have no God Chests!", ephemeral: true });
  player.godChest--;
  const luck = player.activeLuck;
  const mystChance = boostedChance(25, luck), vbChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < mystChance) {
    player.mysteriousChest++;
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_myst_inline`).setLabel("🔵 Open Mysterious Chest Now").setStyle(ButtonStyle.Primary));
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("🔵 A Mysterious Chest appeared!").setDescription("A **BLUE MYSTERIOUS CHEST** emerged from the God Chest!\n\nOpen it to reveal its contents!").setFooter({ text: "Click to open!" });
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const col = reply.createMessageComponentCollector({ time: 60000 });
    col.on("collect", async (btn) => {
      if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
      await openMysteriousChestInteraction(btn, userId); col.stop();
    });
  } else if (rng < mystChance + vbChance) {
    addVbucks(userId, 1000);
    const updated = getUser(userId);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🌟 God Chest — 1,000 V-Bucks!").setDescription(`You received **1,000 V-Bucks** from the God Chest!\nTotal: **${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌟 God Chest — Empty").setDescription("The God Chest glimmered... but was hollow inside.\n\nBetter luck next time!").setFooter({ text: `Myst: ${mystChance}% | 1k V-Bucks: ${vbChance}% | Nothing: rest` })] });
  }
}

async function openMysteriousChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.mysteriousChest <= 0) return interaction.reply({ content: "❌ You have no Mysterious Chests!", ephemeral: true });
  player.mysteriousChest--;
  const luck = player.activeLuck;
  const infChance = boostedChance(15, luck), tenKChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < infChance) {
    player.infiniteVbucks = true;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — INFINITE V-BUCKS!").setDescription("✨ **INFINITE V-BUCKS!** ✨\nYour V-Bucks will **never go down** again!")] });
  } else if (rng < infChance + tenKChance) {
    addVbucks(userId, 10000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 10,000 V-Bucks!").setDescription(`You received **10,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    addVbucks(userId, 1000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 1,000 V-Bucks").setDescription(`You received **1,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  }
}

// ─────────────────────────────────────────────
//  Founders Box roll
// ─────────────────────────────────────────────
const FOUNDERS_BOX_TIERS = [
  { amount: 100, weight: 40 }, { amount: 200, weight: 30 },
  { amount: 350, weight: 20 }, { amount: 550, weight: 10 },
];
function rollFoundersBoxVbucks() {
  const total = FOUNDERS_BOX_TIERS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const t of FOUNDERS_BOX_TIERS) { r -= t.weight; if (r <= 0) return t.amount; }
  return 100;
}

// ─────────────────────────────────────────────
//  Spawn system
// ─────────────────────────────────────────────
const activeSpawns = {};
const spawnTimers = {};
let botClient = null;
const MIN_SPAWN_MS = 3 * 60 * 1000, MAX_SPAWN_MS = 5 * 60 * 1000;
function getNextSpawnDelay() { return MIN_SPAWN_MS + Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS); }
function getActiveSpawn(guildId) { return activeSpawns[guildId] ?? null; }
function scheduleNextSpawn(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  if (activeSpawns[guildId]) return;
  spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
}
async function spawnRandom(client, guildId, channelId) {
  const r = Math.random();
  if (r < 1/35) await spawnStwPacks(client, guildId, channelId);
  else if (r < 2/35) await spawnLuckPotion(client, guildId, channelId);
  else await spawnSkin(client, guildId, channelId);
}
async function spawnSkin(client, guildId, channelId, forced = false, specificSkin) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const skin = specificSkin ?? await getRandomSkin();
    const embed = new EmbedBuilder().setTitle(`${getRarityEmoji(skin.rarity)} **${skin.name}** has spawned!`).setDescription(`*${skin.description}*\n\n✨ **Rarity:** ${skin.rarity}\n\nType \`buy\` to claim!`).setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setFooter({ text: "Fortnite Skin Catcher • First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "skin", skin, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnVbucks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("💰 V-Bucks Drop!").setDescription("A bag of **1,000 V-Bucks** has appeared!\n\nType `buy` to grab them!").setColor(0x00d4ff).setImage(VBUCKS_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "vbucks", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnStwPacks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("⚡ Save the World Pack Drop!").setDescription("**5 Save the World Packs** have appeared!\n\nType `buy` to claim all 5 boxes!").setColor(0xff6600).setImage(STW_LOGO_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "stw_packs", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersPack(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("🌟 Founders Pack Has Spawned!").setDescription("A rare **Founders Pack** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_PACK_IMAGE).setFooter({ text: "Very rare!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_pack", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersBox(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Has Spawned!").setDescription("A **Founders Box** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_BOX_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_box", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnLuckPotion(client, guildId, channelId, forced = false, type = "luckPotion") {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion" };
  const label = labels[type] || labels.luckPotion;
  const realType = labels[type] ? type : "luckPotion";
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle(`${label} Spawned!`).setDescription(`A **${label}** has appeared!\n\nType \`buy\` to claim!`).setColor(0x2ecc71).setImage(LUCK_POT_IMG).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: realType, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function handleBuyMessage(message) {
  const guildId = message.guildId;
  if (!guildId) return;
  const channelId = getSpawnChannel(guildId);
  if (!channelId || message.channelId !== channelId) return;
  const spawn = activeSpawns[guildId];
  if (!spawn || spawn.claimedBy) return;
  const userId = message.author.id;
  if (isEliminated(userId)) {
    const m = Math.ceil(getEliminationTimeLeft(userId) / 60000);
    await message.channel.send({ content: `<@${userId}> ☠️ Eliminated! Can't catch anything for **${m} min**. Ask someone to \`/reboot\` you!` });
    return;
  }
  if (spawn.type === "founders_pack") {
    const user = getUser(userId);
    if (user.hasFoundersPack) { await message.channel.send({ content: `<@${userId}> ❌ You already own a Founders Pack!` }); return; }
  }
  spawn.claimedBy = userId;
  delete activeSpawns[guildId];
  const { gainedVbucks } = addInteraction(userId);
  addXP(userId, 50);
  updateUser(userId, { spawnCatches: (getUser(userId).spawnCatches ?? 0) + 1 });
  let embed;
  if (spawn.type === "vbucks") {
    addVbucks(userId, 1000);
    let desc = `<@${userId}> grabbed **1,000 V-Bucks**! 💰\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`💰 ${message.author.username} grabbed the V-Bucks!`).setDescription(desc).setColor(0x00d4ff).setTimestamp();
  } else if (spawn.type === "stw_packs") {
    updateUser(userId, { boxes: getUser(userId).boxes + 5 });
    let desc = `<@${userId}> claimed **5 STW Packs**! Open them with \`/savetheworld\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed STW Packs!`).setDescription(desc).setColor(0xff6600).setTimestamp();
  } else if (spawn.type === "founders_pack") {
    updateUser(userId, { hasFoundersPack: true });
    let desc = `<@${userId}> claimed the **Founders Pack**! 🌟\n\nUse \`/founderspack\` to open boxes and complete bot quests!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🌟 ${message.author.username} claimed the Founders Pack!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "founders_box") {
    const u3 = getUser(userId);
    updateUser(userId, { foundersBoxes: (u3.foundersBoxes ?? 0) + 1 });
    const msg2 = u3.hasFoundersPack ? "Open it with `/founderspack`!" : "Get a Founders Pack to open it!";
    let desc = `<@${userId}> claimed a **Founders Box**! 📦\n\n${msg2}\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed a Founders Box!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "luckPotion" || spawn.type === "xtraLuckPotion") {
    const u4 = getUser(userId);
    updateUser(userId, { [spawn.type]: (u4[spawn.type] ?? 0) + 1 });
    const label = spawn.type === "luckPotion" ? "🍀 Luck Potion" : "🔮 Xtra Luck Potion";
    let desc = `<@${userId}> grabbed a **${label}**! Use it with \`/useluckpotion\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`✨ ${message.author.username} claimed a ${label}!`).setDescription(desc).setColor(0x2ecc71).setTimestamp();
  } else if (spawn.type === "skin" && spawn.skin) {
    addSkinToInventory(userId, spawn.skin.id, spawn.skin.name);
    progressQuest(userId, "catch_skins");
    const na = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> snagged **${spawn.skin.name}**!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🏆 ${message.author.username} caught ${spawn.skin.name}!`).setDescription(desc).setColor(getRarityColor(spawn.skin.rarity)).setThumbnail(spawn.skin.imageUrl).setTimestamp();
  } else return;
  await message.channel.send({ embeds: [embed] });
  if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
}

function initSpawner(client) {
  botClient = client;
  for (const [guildId, channelId] of Object.entries(getAllGuildSpawnChannels())) {
    if (!channelId) continue;
    spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
  }
}
function restartSpawner(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  delete activeSpawns[guildId];
  scheduleNextSpawn(client, guildId, channelId);
}

// ─────────────────────────────────────────────
//  Slash Commands
// ─────────────────────────────────────────────
const commands = [

  // ── /setup ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("setup").setDescription("Set the channel where Fortnite skins will spawn").addChannelOption((o) => o.setName("channel").setDescription("Text channel for spawns").addChannelTypes(ChannelType.GuildText).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel", true);
      setSpawnChannel(guildId, channel.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Bot Setup Complete!").setDescription(`Skins will spawn in <#${channel.id}>!\n\nFirst skin appears shortly, then every **3–5 minutes**.\n\nType \`buy\` to catch spawns!`).setColor(0x00d4ff).setTimestamp()] });
      if (interaction.client) restartSpawner(interaction.client, guildId, channel.id);
    },
  },

  // ── /forcespawn ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("forcespawn").setDescription("Force a spawn in the spawn channel").addStringOption((o) => o.setName("item").setDescription("What to spawn").setRequired(false).addChoices({ name: "Random Skin", value: "skin" }, { name: "V-Bucks Drop", value: "vbucks" }, { name: "STW Packs", value: "stw" }, { name: "Founders Pack", value: "founders_pack" }, { name: "Founders Box", value: "founders_box" }, { name: "Luck Potion", value: "luckPotion" }, { name: "Xtra Luck Potion", value: "xtraLuckPotion" })).addStringOption((o) => o.setName("skin_name").setDescription("Specific skin name").setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channelId = getSpawnChannel(guildId);
      if (!channelId) return interaction.reply({ content: "❌ No spawn channel! Use `/setup` first.", ephemeral: true });
      if (getActiveSpawn(guildId)) return interaction.reply({ content: `⚠️ Something is already spawned!`, ephemeral: true });
      const skinName = interaction.options.getString("skin_name");
      const item = interaction.options.getString("item") ?? "skin";
      if (skinName) {
        await interaction.deferReply({ ephemeral: true });
        const match = await findSkinByName(skinName);
        if (!match) { await interaction.editReply({ content: `❌ Couldn't find **"${skinName}"**.` }); return; }
        await interaction.editReply({ content: `🎮 Spawning **${match.name}** in <#${channelId}>...` });
        await spawnSkin(interaction.client, guildId, channelId, true, match); return;
      }
      const actions = { skin: () => spawnSkin(interaction.client, guildId, channelId, true), vbucks: () => spawnVbucks(interaction.client, guildId, channelId, true), stw: () => spawnStwPacks(interaction.client, guildId, channelId, true), founders_pack: () => spawnFoundersPack(interaction.client, guildId, channelId, true), founders_box: () => spawnFoundersBox(interaction.client, guildId, channelId, true), luckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "luckPotion"), xtraLuckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "xtraLuckPotion") };
      await interaction.reply({ content: `✅ Spawning in <#${channelId}>...`, ephemeral: true });
      await (actions[item] ?? actions.skin)();
    },
  },

  // ── /vbucks ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("vbucks").setDescription("Check your V-Bucks balance"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId);
      const { gainedVbucks } = addInteraction(userId);
      progressQuest(userId, "check_vbucks");
      const user = getUser(userId);
      user.vbucksChecked = (user.vbucksChecked ?? 0) + 1;
      const nextMilestone = 30 - (user.interactionCount % 30);
      const tier = getBattlePassTier(user.level, user.xp);
      const embed = new EmbedBuilder().setTitle("💰 V-Bucks Balance")
        .setDescription(`**${interaction.user.username}**, your wallet:\n\n💰 **${user.infiniteVbucks ? "INFINITE ∞" : user.vbucks.toLocaleString()} V-Bucks**\n\n📊 **Level:** ${user.level} · **XP:** ${user.xp}\n🎮 **Battle Pass Tier:** ${tier}/100\n🏗️ **Build:** ${user.buildCharges > 0 ? `${BUILD_MATS[user.buildMaterial]?.label ?? "🪵 Wood"} (${user.buildCharges} charge${user.buildCharges !== 1 ? "s" : ""})` : "None"}\n💬 **Interactions:** ${user.interactionCount}\n🎁 **Next bonus in:** ${nextMilestone} interactions`)
        .setColor(0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
        .setFooter({ text: gainedVbucks ? "🎉 You just earned 250 V-Bucks for a milestone!" : "Earn 250 V-Bucks every 30 interactions!" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /itemshop ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("itemshop").setDescription("Browse today's Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId); progressQuest(userId, "check_shop");
      const skins = await ensureShopFresh();
      let page = 0;
      const buildPage = (p) => {
        const skin = skins[p], user = getUser(userId);
        const discount = user.creatorDiscount ?? 0, finalPrice = Math.floor(skin.price * (1 - discount));
        const embed = new EmbedBuilder().setTitle(`🛒 Item Shop — Skin ${p + 1} of ${skins.length}`)
          .setDescription(`${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ Rarity: **${skin.rarity}**\n\n💰 **Price: ${finalPrice.toLocaleString()} V-Bucks**${user.hasCreatorCode ? ` 🏷️ *(${Math.round(discount * 100)}% off)*` : ""}\n\n🔄 Shop resets in **${getTimeUntilReset()}**`)
          .setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setFooter({ text: "Use /creatorcode for a discount!" }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shop_prev_${p}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`shop_buy_${p}`).setLabel(`Buy — ${finalPrice.toLocaleString()} V-Bucks`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`shop_next_${p}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= skins.length - 1)
        );
        return { embed, row, finalPrice };
      };
      const { embed, row } = buildPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId.startsWith("shop_prev")) { page = Math.max(0, page - 1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_next")) { page = Math.min(skins.length - 1, page + 1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_buy")) {
          const skin = skins[page], freshUser = getUser(userId);
          const fp = Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
          if (!freshUser.infiniteVbucks && freshUser.vbucks < fp) {
            if (!freshUser.brokeAttempt) { updateUser(userId, { brokeAttempt: true }); const ach = awardAchievement(userId, "broke"); await btn.reply({ content: `❌ Need **${fp.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: ach ? [buildAchievementEmbed(ach)] : [] }); }
            else await btn.reply({ content: `❌ Not enough V-Bucks!` });
            return;
          }
          if (freshUser.inventory.includes(skin.skinId)) { await btn.reply({ content: `⚠️ Already own **${skin.name}**!` }); return; }
          if (!freshUser.infiniteVbucks) addVbucks(userId, -fp);
          addSkinToInventory(userId, skin.skinId, skin.name);
          updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: fp } });
          checkAndAwardAchievements(userId);
          const updated = getUser(userId);
          await btn.reply({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n💰 Spent: ${fp.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp()] });
        }
      });
      collector.on("end", async () => { const { embed: e } = buildPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /buy ─────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("buy").setDescription("Purchase a skin from the current Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      if (isEliminated(userId)) { const m = Math.ceil(getEliminationTimeLeft(userId) / 60000); await interaction.editReply({ content: `☠️ Eliminated for **${m} min**. Ask someone to \`/reboot\` you.` }); return; }
      const skins = await ensureShopFresh(), user = getUser(userId);
      const isFree = hasActiveFreeSkin(userId), discount = isFree ? 1 : (user.creatorDiscount ?? 0);
      const options = skins.map((s, i) => { const fp = isFree ? 0 : Math.floor(s.price * (1 - discount)); return new StringSelectMenuOptionBuilder().setLabel(isFree ? `${s.name} — FREE 🎁` : `${s.name} — ${fp.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i)); });
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("buy_select").setPlaceholder("Choose a skin...").addOptions(options));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(isFree ? "🎁 Free Skin! Pick Yours" : "🛒 Buy a Skin").setDescription(isFree ? "Free skin from Tylajadee creator code!" : `Balance: **${user.vbucks.toLocaleString()} V-Bucks**\n\nSelect a skin:`).setColor(isFree ? 0xffd700 : 0x00d4ff).setTimestamp()], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const skin = skins[parseInt(sel.values[0])], freshUser = getUser(userId);
        const freshFree = hasActiveFreeSkin(userId), fp = freshFree ? 0 : Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
        if (!freshFree && !freshUser.infiniteVbucks && freshUser.vbucks < fp) { await sel.update({ content: `❌ Need **${fp.toLocaleString()} V-Bucks**.`, embeds: [], components: [] }); return; }
        if (freshUser.inventory.includes(skin.skinId)) { await sel.update({ content: `⚠️ Already own **${skin.name}**!`, embeds: [], components: [] }); return; }
        if (fp > 0 && !freshUser.infiniteVbucks) addVbucks(userId, -fp);
        addSkinToInventory(userId, skin.skinId, skin.name);
        updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: fp }, ...(freshFree ? { freeSkinRedeemed: true } : {}) });
        checkAndAwardAchievements(userId);
        const updated = getUser(userId);
        await sel.update({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n\n💰 **Spent:** ${fp.toLocaleString()} V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp()], components: [] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /gift ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("gift").setDescription("Gift a skin from the Item Shop to another player").addUserOption((o) => o.setName("player").setDescription("Player to gift to").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't gift yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't gift bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const skins = await ensureShopFresh(), user = getUser(userId);
      const options = skins.map((s, i) => new StringSelectMenuOptionBuilder().setLabel(`${s.name} — ${s.price.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i)));
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("gift_select").setPlaceholder("Choose a skin to gift...").addOptions(options));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎁 Gift a Skin to ${target.username}`).setDescription(`Your balance: **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks**\n\nSelect a skin:`).setColor(0xff69b4).setTimestamp()], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const skin = skins[parseInt(sel.values[0])], freshUser = getUser(userId);
        if (!freshUser.infiniteVbucks && freshUser.vbucks < skin.price) { await sel.update({ content: `❌ Need **${skin.price.toLocaleString()} V-Bucks**.`, embeds: [], components: [] }); return; }
        const targetUser = getUser(target.id);
        if (targetUser.inventory.includes(skin.skinId)) {
          const alreadyEmbed = new EmbedBuilder().setTitle("⚠️ They Already Own This Skin!").setDescription(`**${target.username}** already owns **${skin.name}**!\n\nSend them **1,500 V-Bucks** instead?`).setColor(0xffaa00).setTimestamp();
          const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("gift_vb_yes").setLabel("✅ Yes — Send 1,500 V-Bucks").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("gift_vb_no").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
          await sel.update({ embeds: [alreadyEmbed], components: [confirmRow] }); collector.stop();
          const btnMsg = await interaction.fetchReply();
          const btnCol = btnMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000, filter: (b) => b.user.id === userId });
          btnCol.on("collect", async (btn) => {
            if (btn.customId === "gift_vb_yes") {
              const latest = getUser(userId);
              if (!latest.infiniteVbucks && latest.vbucks < 1500) { await btn.update({ content: "❌ Not enough V-Bucks!", embeds: [], components: [] }); return; }
              if (!latest.infiniteVbucks) addVbucks(userId, -1500);
              addVbucks(target.id, 1500);
              const after = getUser(userId);
              await btn.update({ embeds: [new EmbedBuilder().setTitle("💸 V-Bucks Transferred!").setDescription(`Sent **1,500 V-Bucks** to <@${target.id}>!\n💳 Remaining: ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()], components: [] });
              if (interaction.channel?.send) await interaction.channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("💸 You received V-Bucks!").setDescription(`<@${userId}> sent you **1,500 V-Bucks**!`).setColor(0x00d4ff).setTimestamp()] });
            } else await btn.update({ content: "❌ Gift cancelled.", embeds: [], components: [] });
            btnCol.stop();
          });
          return;
        }
        if (!freshUser.infiniteVbucks) addVbucks(userId, -skin.price);
        addSkinToInventory(target.id, skin.skinId, skin.name);
        updateUser(userId, { giftsGiven: (freshUser.giftsGiven ?? 0) + 1 }); checkAndAwardAchievements(userId);
        const senderAfter = getUser(userId);
        await sel.update({ embeds: [new EmbedBuilder().setTitle("🎁 Gift Sent!").setDescription(`${getRarityEmoji(skin.rarity)} You gifted **${skin.name}** to <@${target.id}>!\n\n💰 Spent: ${skin.price.toLocaleString()} V-Bucks\n💳 Remaining: ${senderAfter.infiniteVbucks ? "∞" : senderAfter.vbucks.toLocaleString()} V-Bucks`).setColor(0xff69b4).setThumbnail(skin.imageUrl).setTimestamp()], components: [] });
        if (interaction.channel?.send) await interaction.channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🎁 You received a gift!").setDescription(`<@${userId}> sent you **${skin.name}**!\n\nCheck \`/inventory\`!`).setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setTimestamp()] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /coinflip ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("coinflip").setDescription("Challenge another player to a V-Bucks coin flip!").addUserOption((o) => o.setName("player").setDescription("Player to challenge").setRequired(true)).addIntegerOption((o) => o.setName("amount").setDescription("V-Bucks to bet (default: 100)").setMinValue(10).setMaxValue(10000)),
    async execute(interaction) {
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const amount = interaction.options.getInteger("amount") ?? 100;
      if (target.id === userId) { await interaction.reply({ content: "❌ Can't challenge yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't challenge bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId);
      if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.reply({ content: `❌ Need **${amount.toLocaleString()} V-Bucks**.` }); return; }
      const targetUser = getUser(target.id);
      if (!targetUser.infiniteVbucks && targetUser.vbucks < amount) { await interaction.reply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
      progressQuest(userId, "challenge_flip");
      updateUser(userId, { coinflipsPlayed: (challenger.coinflipsPlayed ?? 0) + 1 });
      const challengeId = `${userId}_${target.id}_${Date.now()}`;
      const embed = new EmbedBuilder().setTitle("🪙 Coin Flip Challenge!").setDescription(`<@${userId}> challenged <@${target.id}>!\n\n💰 **Bet:** ${amount.toLocaleString()} V-Bucks\n\n<@${target.id}>, pick your side!`).setColor(0xf4a01a).setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`flip_heads_${challengeId}`).setLabel("🪙 Heads").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_tails_${challengeId}`).setLabel("🪙 Tails").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_decline_${challengeId}`).setLabel("❌ Decline").setStyle(ButtonStyle.Danger));
      const msg = await interaction.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });
      setCoinflipChallenge(challengeId, { challengerId: userId, challengedId: target.id, amount });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id || b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.user.id !== target.id && !btn.customId.includes("decline")) { await btn.reply({ content: "❌ Only the challenged player can pick!", ephemeral: true }); return; }
        const challenge = getCoinflipChallenge(challengeId);
        if (!challenge) { await btn.update({ content: "❌ Challenge expired.", embeds: [], components: [] }); return; }
        if (btn.customId.includes("decline")) { deleteCoinflipChallenge(challengeId); await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Challenge Declined").setDescription(`<@${target.id}> declined.`).setColor(0xff0000).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
        const pickedHeads = btn.customId.includes("heads");
        const result = Math.random() < 0.5 ? "heads" : "tails";
        const won = (pickedHeads && result === "heads") || (!pickedHeads && result === "tails");
        const winnerId = won ? target.id : userId, loserId = won ? userId : target.id;
        if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
        addVbucks(winnerId, amount); addXP(winnerId, 100);
        const winner = getUser(winnerId); winner.coinflipsWon = (winner.coinflipsWon ?? 0) + 1;
        checkAndAwardAchievements(winnerId);
        progressQuest(won ? target.id : userId, "win_coinflip");
        deleteCoinflipChallenge(challengeId);
        await btn.update({ embeds: [new EmbedBuilder().setTitle(`🪙 The coin landed on **${result.toUpperCase()}**!`).setDescription(`${btn.user.username} picked **${pickedHeads ? "Heads" : "Tails"}**.\n\n🏆 **<@${winnerId}> wins ${amount.toLocaleString()} V-Bucks!**\n💸 <@${loserId}> loses ${amount.toLocaleString()} V-Bucks.`).setColor(won ? 0x00ff00 : 0xff0000).setTimestamp()], components: [], content: "" });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") { deleteCoinflipChallenge(challengeId); interaction.editReply({ content: "⏰ Challenge expired.", embeds: [], components: [] }).catch(() => {}); } });
    },
  },

  // ── /savetheworld ────────────────────────
  {
    data: new SlashCommandBuilder().setName("savetheworld").setDescription("View your Save the World quests and earn XP to level up"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const buildSTWEmbed = () => {
        const user = getUser(userId), li = calculateLevelFromXP(user.xp);
        const bar = "█".repeat(Math.round((li.xpInLevel / li.xpForNext) * 10)) + "░".repeat(10 - Math.round((li.xpInLevel / li.xpForNext) * 10));
        const questLines = user.quests.map((q) => { const done = q.completed ? "✅" : "🔲"; const qb = "█".repeat(Math.round((q.current / q.required) * 8)) + "░".repeat(8 - Math.round((q.current / q.required) * 8)); return `${done} **${q.label}**\n   \`${qb}\` ${q.current}/${q.required} · +${q.xpReward} XP`; });
        return new EmbedBuilder().setTitle("⚡ Save the World").setDescription(`**${interaction.user.username}** — Level **${user.level}** · **${user.boxes}** box(es)\n\n**XP Progress:**\n\`${bar}\` ${li.xpInLevel}/${li.xpForNext}\n\n**Daily Quests:**\n\n${questLines.join("\n\n")}\n\n*Quests reset every 24h. Level up to earn STW Boxes!*`).setColor(0xff6600).setFooter({ text: "Complete quests to level up and earn STW Boxes!" }).setTimestamp();
      };
      const buildSTWRow = () => { const user = getUser(userId); return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`stw_openbox`).setLabel(user.boxes > 0 ? `🎁 Open Box (${user.boxes} available)` : "🎁 No Boxes Yet").setStyle(user.boxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(user.boxes === 0), new ButtonBuilder().setCustomId(`stw_refresh`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Primary)); };
      const msg = await interaction.reply({ embeds: [buildSTWEmbed()], components: [buildSTWRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId === "stw_refresh") { resetQuestsIfNeeded(userId); await btn.update({ embeds: [buildSTWEmbed()], components: [buildSTWRow()] }); return; }
        if (btn.customId === "stw_openbox") {
          const freshUser = getUser(userId);
          if (freshUser.boxes <= 0) { await btn.reply({ content: "❌ No boxes!", ephemeral: true }); return; }
          updateUser(userId, { boxes: freshUser.boxes - 1, boxesOpened: (freshUser.boxesOpened ?? 0) + 1 }); checkAndAwardAchievements(userId);
          let resultEmbed;
          if (Math.random() < 0.2) { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); }
          else { const stwSkin = await getRandomStwSkin(); if (stwSkin) { addSkinToInventory(userId, stwSkin.id, stwSkin.name); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`${getRarityEmoji(stwSkin.rarity)} **${stwSkin.name}**!\n✨ Rarity: **${stwSkin.rarity}**\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(getRarityColor(stwSkin.rarity)).setImage(stwSkin.imageUrl).setTimestamp(); }
          else { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); } }
          await btn.reply({ embeds: [resultEmbed] });
          await interaction.editReply({ components: [buildSTWRow()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /founderspack (UNIFIED) ──────────────
  {
    data: new SlashCommandBuilder().setName("founderspack").setDescription("Founders Pack — view bot quests (auto-complete), open Founders Boxes, and more"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!user.hasFoundersPack) {
        if ((user.foundersBoxes ?? 0) > 0) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Waiting!").setDescription(`You have **${user.foundersBoxes} Founders Box${user.foundersBoxes > 1 ? "es" : ""}** waiting — but no **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when a Founders Pack appears!`).setColor(0xffd700).setImage(FP_PACK_IMAGE).setTimestamp()] }); return; }
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔒 Founders Pack Required").setDescription(`You don't own a **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when a Founders Pack appears!\n\n**Once unlocked you get:**\n• Bot-related quests that auto-complete\n• Founders Boxes worth 100–550 V-Bucks each\n• 5% chance for a 🌟 God Chest from each box`).setColor(0xff4444).setImage(FP_PACK_IMAGE).setTimestamp()] }); return;
      }
      let autoAwardMsg = "";
      const { newBoxes, quests: checkedQuests } = checkFoundersQuests(userId);
      if (newBoxes > 0) autoAwardMsg = `\n\n🎉 **${newBoxes} quest${newBoxes > 1 ? "s" : ""} completed — +${newBoxes} Founders Box${newBoxes > 1 ? "es" : ""}!**`;
      const allDone = checkedQuests.length === 0 || checkedQuests.every((q) => q.awardedBox);
      if (allDone) assignFoundersQuests(userId);

      const buildFPEmbed = () => {
        const fu = getUser(userId);
        const quests = fu.foundersQuestPending ?? [];
        const questLines = quests.map((q) => {
          const current = Math.min((fu[q.stat] ?? 0) - (q.baseline ?? 0), q.required);
          const qb = "█".repeat(Math.round((current / q.required) * 8)) + "░".repeat(8 - Math.round((current / q.required) * 8));
          const done = current >= q.required;
          return `${done ? "✅" : "🔲"} **${q.label}**\n   \`${qb}\` ${current}/${q.required}${done ? " *(auto-awarded!)*" : ""}`;
        });
        return new EmbedBuilder().setTitle("🌟 Founders Pack")
          .setDescription(`Welcome, Founder! 🎉${autoAwardMsg}\n\n📦 **Founders Boxes:** ${fu.foundersBoxes}\n📬 **Boxes Opened:** ${fu.foundersBoxesOpened ?? 0}\n\n**Bot Quests** *(auto-complete as you play!)*\n\n${questLines.length ? questLines.join("\n\n") : "*No quests — click Refresh!*"}\n\n**Box Rewards:**\n> 💰 100 V-Bucks — *40%*\n> 💰 200 V-Bucks — *30%*\n> 💰 350 V-Bucks — *20%*\n> 💰 550 V-Bucks — *10%*\n> 🌟 God Chest — *5%*`)
          .setColor(0xffd700).setImage(FP_BOX_IMAGE).setTimestamp();
      };
      const buildFPRow = () => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("fp_open").setLabel(fu.foundersBoxes > 0 ? `📦 Open Box (${fu.foundersBoxes} available)` : "📦 No Boxes").setStyle(fu.foundersBoxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(fu.foundersBoxes === 0),
          new ButtonBuilder().setCustomId("fp_refresh").setLabel("🔄 Check Quests").setStyle(ButtonStyle.Primary)
        );
      };
      const msg = await interaction.reply({ embeds: [buildFPEmbed()], components: [buildFPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId === "fp_refresh") {
          const { newBoxes: nb2 } = checkFoundersQuests(userId);
          const fu2 = getUser(userId);
          if ((fu2.foundersQuestPending ?? []).every((q) => q.awardedBox)) assignFoundersQuests(userId);
          await btn.update({ embeds: [buildFPEmbed()], components: [buildFPRow()] }); return;
        }
        if (btn.customId === "fp_open") {
          const fu = getUser(userId);
          if ((fu.foundersBoxes ?? 0) <= 0) { await btn.reply({ content: "❌ No Founders Boxes!", ephemeral: true }); return; }
          updateUser(userId, { foundersBoxes: fu.foundersBoxes - 1, foundersBoxesOpened: (fu.foundersBoxesOpened ?? 0) + 1 });
          const godChestChance = boostedChance(5, fu.activeLuck ?? "none");
          if (roll(godChestChance)) {
            const upd = getUser(userId); upd.godChest = (upd.godChest ?? 0) + 1;
            const godRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fp_open_godchest").setLabel("🌟 Open God Chest").setStyle(ButtonStyle.Success));
            await btn.reply({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🌟 GOD CHEST!").setDescription("A **GOLD GOD CHEST** appeared from your Founders Box!\n\n> ⚡ This is extremely rare — do you dare open it?").setFooter({ text: "Click to open!" })], components: [godRow] });
            const godMsg = await btn.fetchReply();
            const godCol = godMsg.createMessageComponentCollector({ time: 60000 });
            godCol.on("collect", async (b2) => {
              if (b2.user.id !== userId) return b2.reply({ content: "❌ Not your chest!", ephemeral: true });
              await openGodChestInteraction(b2, userId); godCol.stop();
            });
          } else {
            const won = rollFoundersBoxVbucks(); addVbucks(userId, won);
            const afterUser = getUser(userId);
            await btn.reply({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Opened!").setDescription(`🎉 You found **${won.toLocaleString()} V-Bucks** inside!\n\n💳 **New balance:** ${afterUser.infiniteVbucks ? "∞" : afterUser.vbucks.toLocaleString()} V-Bucks\n📦 **Boxes remaining:** ${afterUser.foundersBoxes}`).setColor(0xffd700).setTimestamp()] });
          }
          await interaction.editReply({ components: [buildFPRow()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /inventory ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("inventory").setDescription("View your Fortnite skin collection and items"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const names = Object.values(user.inventoryNames);
      const luck = user.activeLuck === "none" ? "None" : { normal: "🍀 Luck Potion (+15%)", xtra: "🔮 Xtra Luck Potion (+40%)", godly: "⚡ Godly Luck Potion (+80%)" }[user.activeLuck];
      const totalPages = Math.max(1, Math.ceil(names.length / 10));
      let page = 0;
      const buildInvPage = (p) => {
        const slice = names.slice(p * 10, p * 10 + 10);
        const lines = slice.map((name, i) => `${p * 10 + i + 1}. **${name}**`);
        const matInfo = user.buildCharges > 0 ? `${BUILD_MATS[user.buildMaterial]?.label ?? "🪵 Wood"} — ${user.buildCharges} charge${user.buildCharges !== 1 ? "s" : ""}` : "None";
        const itemsSection = `**Items:**\n🍀 Luck: ${user.luckPotion || 0} | 🔮 Xtra: ${user.xtraLuckPotion || 0} | ⚡ Godly: ${user.godlyLuckPotion || 0}\n🌟 God Chests: ${user.godChest || 0} | 🔵 Mysterious: ${user.mysteriousChest || 0}\n📦 Founders Boxes: ${user.foundersBoxes || 0} | 🏗️ Build: ${matInfo}`;
        const embed = new EmbedBuilder().setTitle(`🎒 ${interaction.user.username}'s Inventory`).setDescription((lines.length ? lines.join("\n") + "\n\n" : "*No skins yet.*\n\n") + itemsSection + `\n\n💰 **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks** | ✨ Luck: **${luck}**`).setColor(0x00d4ff).setFooter({ text: `Page ${p + 1} of ${totalPages} • ${names.length} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`inv_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0), new ButtonBuilder().setCustomId(`inv_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1));
        return { embed, row };
      };
      const { embed, row } = buildInvPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => { if (btn.customId === "inv_prev") page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1); await btn.update({ ...buildInvPage(page) }); });
      collector.on("end", async () => { const { embed: e } = buildInvPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /trade ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("trade").setDescription("Offer a skin trade with another player").addUserOption((o) => o.setName("player").setDescription("Player to trade with").setRequired(true)),
    async execute(interaction) {
      const initiatorId = interaction.user.id, target = interaction.options.getUser("player", true);
      if (target.id === initiatorId) { await interaction.reply({ content: "❌ Can't trade with yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't trade with bots!" }); return; }
      resetQuestsIfNeeded(initiatorId); addInteraction(initiatorId);
      const initUser = getUser(initiatorId), targUser = getUser(target.id);
      const initSkins = Object.entries(initUser.inventoryNames), targSkins = Object.entries(targUser.inventoryNames);
      if (!initSkins.length) { await interaction.reply({ content: "❌ You have no skins to trade!" }); return; }
      if (!targSkins.length) { await interaction.reply({ content: `❌ <@${target.id}> has no skins!` }); return; }
      let initPick = null, targPick = null;
      const initRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_initiator`).setPlaceholder(`${interaction.user.username}, pick your skin...`).addOptions(initSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
      const msg = await interaction.reply({ content: `<@${initiatorId}> <@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> wants to trade with <@${target.id}>!\n\n**<@${initiatorId}>** — pick your skin below.`).setColor(0x00d4ff).setFooter({ text: "Expires in 2 minutes" }).setTimestamp()], components: [initRow], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 2 * 60 * 1000, filter: (i) => i.user.id === initiatorId || i.user.id === target.id });
      collector.on("collect", async (i) => {
        if (i.isStringSelectMenu()) {
          if (i.customId === "trade_initiator" && i.user.id === initiatorId) {
            initPick = { key: i.values[0], name: initUser.inventoryNames[i.values[0]] };
            const targetRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_target`).setPlaceholder(`${target.username}, pick your skin...`).addOptions(targSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> offers **${initPick.name}**.\n\n<@${target.id}>, pick what you'd like to offer!`).setColor(0xf4a01a).setTimestamp()], components: [targetRow] }); return;
          }
          if (i.customId === "trade_target" && i.user.id === target.id) {
            if (!initPick) { await i.reply({ content: "❌ Wait for the other player!", ephemeral: true }); return; }
            targPick = { key: i.values[0], name: targUser.inventoryNames[i.values[0]] };
            const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trade_confirm_initiator").setLabel(`✅ ${interaction.user.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_confirm_target").setLabel(`✅ ${target.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Confirm Trade").setDescription(`**<@${initiatorId}>** offers: **${initPick.name}**\n**<@${target.id}>** offers: **${targPick.name}**\n\nBoth must confirm!`).setColor(0x1a9b1a).setTimestamp()], components: [confirmRow] }); return;
          }
        }
        if (i.isButton()) {
          if (i.customId === "trade_cancel") { await i.update({ content: "❌ Trade cancelled.", embeds: [], components: [] }); collector.stop(); return; }
          if (i.customId === "trade_confirm_initiator" && i.user.id !== initiatorId) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && i.user.id !== target.id) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && initPick && targPick) {
            const fI = getUser(initiatorId), fT = getUser(target.id);
            delete fI.inventoryNames[initPick.key]; fI.inventory = fI.inventory.filter((id) => id !== initPick.key.split("_")[0]); fI.inventoryNames[targPick.key + "_t"] = targPick.name; fI.inventory.push(targPick.key.split("_")[0]);
            delete fT.inventoryNames[targPick.key]; fT.inventory = fT.inventory.filter((id) => id !== targPick.key.split("_")[0]); fT.inventoryNames[initPick.key + "_t"] = initPick.name; fT.inventory.push(initPick.key.split("_")[0]);
            fI.tradesCompleted = (fI.tradesCompleted ?? 0) + 1; fT.tradesCompleted = (fT.tradesCompleted ?? 0) + 1;
            updateUser(initiatorId, fI); updateUser(target.id, fT); checkAndAwardAchievements(initiatorId); checkAndAwardAchievements(target.id);
            await i.update({ embeds: [new EmbedBuilder().setTitle("✅ Trade Complete!").setDescription(`**<@${initiatorId}>** received **${targPick.name}**\n**<@${target.id}>** received **${initPick.name}**`).setColor(0x00ff00).setTimestamp()], components: [], content: "" });
            collector.stop();
          }
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Trade expired.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /resetshop ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("resetshop").setDescription("Force the Item Shop to reset with 5 new skins").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const skins = await getRandomShopSkins(5);
      setItemShop(skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: 1500 })));
      const lines = skins.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · ${s.rarity}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🛒 Item Shop Reset!").setDescription(`New skins:\n\n${lines.join("\n")}`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /leaderboard ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("leaderboard").setDescription("View top players ranked by skins, V-Bucks, or level"),
    async execute(interaction) {
      await interaction.deferReply();
      let mode = "skins";
      const buildLBEmbed = async (m) => {
        const guild = interaction.guild, allUsers2 = getAllUsers();
        const entries = await Promise.all(Object.entries(allUsers2).map(async ([uid, d]) => {
          let name = `User ${uid.slice(-4)}`;
          if (guild) { try { const mem = await guild.members.fetch(uid).catch(() => null); if (mem) name = mem.displayName; } catch {} }
          const lvl = calculateLevelFromXP(d.xp);
          return { uid, name, skins: d.inventory.length, vbucks: d.vbucks, level: lvl.level, xp: d.xp };
        }));
        const sorted = [...entries].sort((a, b) => m === "skins" ? b.skins - a.skins : m === "vbucks" ? b.vbucks - a.vbucks : b.xp - a.xp);
        const medals = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `**${r}.**`;
        const modeLabel = m === "skins" ? "🎮 Most Skins" : m === "vbucks" ? "💰 Most V-Bucks" : "⭐ Highest Level";
        const lines2 = sorted.slice(0, 10).map((p, i) => `${medals(i + 1)} **${p.name}** — ${m === "skins" ? `${p.skins} skin(s)` : m === "vbucks" ? `${p.vbucks.toLocaleString()} V-Bucks` : `Level ${p.level} · ${p.xp.toLocaleString()} XP`}`);
        return new EmbedBuilder().setTitle(`🏆 Leaderboard — ${modeLabel}`).setDescription(lines2.length ? lines2.join("\n") : "No players yet!").setColor(0xf4a01a).setTimestamp();
      };
      const buildLBRow = (m) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("lb_skins").setLabel("🎮 Most Skins").setStyle(m === "skins" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "skins"), new ButtonBuilder().setCustomId("lb_vbucks").setLabel("💰 Most V-Bucks").setStyle(m === "vbucks" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "vbucks"), new ButtonBuilder().setCustomId("lb_level").setLabel("⭐ Highest Level").setStyle(m === "level" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "level"));
      const embed = await buildLBEmbed(mode);
      const msg = await interaction.editReply({ embeds: [embed], components: [buildLBRow(mode)] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });
      collector.on("collect", async (btn) => {
        if (btn.customId === "lb_skins") mode = "skins"; else if (btn.customId === "lb_vbucks") mode = "vbucks"; else mode = "level";
        await btn.update({ embeds: [await buildLBEmbed(mode)], components: [buildLBRow(mode)] });
      });
      collector.on("end", async () => { await interaction.editReply({ embeds: [await buildLBEmbed(mode)], components: [] }).catch(() => {}); });
    },
  },

  // ── /daily ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("daily").setDescription("Claim your daily V-Bucks reward — streaks add bonus V-Bucks!"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), last = user.lastDailyClaim ?? 0, since = now - last;
      if (since < 24 * 60 * 60 * 1000) {
        const left = 24 * 60 * 60 * 1000 - since, h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏰ Already Claimed!").setDescription(`Already claimed today.\n\n⏳ **Next claim in:** ${h}h ${m}m\n🔥 **Streak:** ${user.dailyStreak} day(s)`).setColor(0xff6600).setTimestamp()] }); return;
      }
      const newStreak = last === 0 || since >= 48 * 60 * 60 * 1000 ? 1 : (user.dailyStreak ?? 0) + 1;
      const reward = 150 + (newStreak - 1) * 100;
      const streakBroken = last !== 0 && since >= 48 * 60 * 60 * 1000 && (user.dailyStreak ?? 0) > 1;
      addVbucks(userId, reward); addXP(userId, 75);
      updateUser(userId, { lastDailyClaim: now, dailyStreak: newStreak });
      const updated = getUser(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Daily Reward Claimed!").setDescription(`${streakBroken ? "⚠️ **Streak reset!**\n\n" : newStreak > 1 ? `🎉 **${newStreak}-day streak!**\n\n` : ""}💰 **+${reward} V-Bucks**!\n💳 **Balance:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n🔥 **Streak:** ${newStreak} day(s)\n📅 **Tomorrow:** ${150 + newStreak * 100} V-Bucks`).setColor(newStreak >= 7 ? 0xf4a01a : newStreak >= 3 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "+75 XP bonus!" }).setTimestamp()] });
      checkAndAwardAchievements(userId);
    },
  },

  // ── /achievements ────────────────────────
  {
    data: new SlashCommandBuilder().setName("achievements").setDescription("View your achievements"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), earned = new Set(user.achievementsEarned ?? []);
      let page = 0; const PAGE_SIZE = 8;
      const buildAchPage = (p) => {
        const total = ALL_ACHIEVEMENTS.length, totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE)), safePage = Math.min(p, totalPages - 1);
        const slice = ALL_ACHIEVEMENTS.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
        const lines = slice.map((a) => earned.has(a.id) ? `🏆 ${a.emoji} **${a.title}**\n   *${a.description}*` : `🔒 ~~${a.emoji} ${a.title}~~\n   ||${a.description}||`);
        const bar = "█".repeat(Math.round((earned.size / total) * 10)) + "░".repeat(10 - Math.round((earned.size / total) * 10));
        const embed = new EmbedBuilder().setTitle(`🏆 ${interaction.user.username}'s Achievements`).setDescription(`\`${bar}\` ${earned.size}/${total}\n\n${lines.join("\n\n")}`).setColor(earned.size === total ? 0xf4a01a : 0x00d4ff).setFooter({ text: `Page ${safePage + 1} of ${totalPages}` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ach_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0), new ButtonBuilder().setCustomId(`ach_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1));
        return { embed, row, totalPages };
      };
      const { embed, row } = buildAchPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        const { totalPages } = buildAchPage(page);
        if (btn.customId === "ach_prev") page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1);
        await btn.update({ ...buildAchPage(page) });
      });
      collector.on("end", async () => { const { embed: e } = buildAchPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /refund ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("refund").setDescription("Request a refund for a skin you bought from the Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, user = getUser(userId);
      const shopSkins = user.shopSkins ?? [];
      if (!shopSkins.length) { await interaction.editReply({ content: "❌ No Item Shop skins eligible for refund." }); return; }
      const refundable = [], seen = new Set();
      for (const skinId of shopSkins) {
        if (seen.has(skinId) || !user.inventory.includes(skinId)) continue; seen.add(skinId);
        const nameKey = Object.keys(user.inventoryNames).find((k) => k.startsWith(skinId + "_")) ?? skinId;
        const name = user.inventoryNames[nameKey] ?? skinId, price = (user.shopSkinPrices ?? {})[skinId] ?? 800;
        const isFree = (user.freeSkinIds ?? []).includes(skinId);
        refundable.push({ skinId, nameKey, name, price, isFree });
      }
      if (!refundable.length) { await interaction.editReply({ content: "❌ None of your shop purchases are still in your inventory." }); return; }
      const options = refundable.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.isFree ? `${s.name} 🎁 (FREE)` : s.name).setDescription(s.isFree ? "⚠️ This was FREE — consequences await" : `Refund: ${s.price.toLocaleString()} V-Bucks`).setValue(s.skinId));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Item Shop Refund").setDescription("Select the skin to refund.\n\n⚠️ **Refunding a FREE skin will have consequences.**").setColor(0xff6600).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("refund_select").setPlaceholder("Choose a skin...").addOptions(options))] });
      const selectCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      selectCol.on("collect", async (sel) => {
        selectCol.stop("selected");
        const skinId = sel.values[0], skin = refundable.find((s) => s.skinId === skinId);
        if (skin.isFree) {
          await sel.update({ content: "Processing...", embeds: [], components: [] });
          const fu = getUser(userId), lostAmount = Math.floor(Math.abs(fu.vbucks) * 0.1), newVb = fu.vbucks - lostAmount;
          const invIdx = fu.inventory.indexOf(skinId); if (invIdx !== -1) fu.inventory.splice(invIdx, 1); delete fu.inventoryNames[skin.nameKey];
          const randomSkinEntry = Object.entries(fu.inventoryNames).filter(([k]) => !(fu.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"))[0];
          let randomRemoved = null;
          if (randomSkinEntry) { randomRemoved = randomSkinEntry[1]; const rsId = randomSkinEntry[0].replace(/_\d+$/, ""); const rsIdx = fu.inventory.indexOf(rsId); if (rsIdx !== -1) fu.inventory.splice(rsIdx, 1); delete fu.inventoryNames[randomSkinEntry[0]]; }
          updateUser(userId, { inventory: fu.inventory, inventoryNames: fu.inventoryNames, shopSkins: (fu.shopSkins ?? []).filter((s) => s !== skinId), vbucks: newVb, eliminatedUntil: Date.now() + 5 * 60 * 1000 });
          awardAchievement(userId, "scammed");
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📧 Email from Epic Games").setDescription(`**From:** noreply@epicgames.com\n**Subject:** Your Refund Request — Seriously?\n\n> We noticed you tried to refund **${skin.name}**, which you got for **FREE**.\n>\n> We've gone ahead and:\n> — Removed **${skin.name}** from your locker\n> — Deducted **${lostAmount.toLocaleString()} V-Bucks** (10% penalty)${randomRemoved ? `\n> — Also removed **${randomRemoved}** as a lesson` : ""}\n> — Suspended you for **5 minutes**\n>\n> Regards, Epic Games\n> *P.S. You are literally so dumb lol*`).setColor(0xff0000).setTimestamp()], components: [] }); return;
        }
        const coolLeft = ((user.refundCooldowns ?? {})[skinId] ?? 0) + 4 * 60 * 60 * 1000 - Date.now();
        if (coolLeft > 0) { await sel.update({ content: `⏳ Still under review. Try again in **${Math.floor(coolLeft / 3600000)}h ${Math.floor((coolLeft % 3600000) / 60000)}m**.`, embeds: [], components: [] }); return; }
        const fu2 = getUser(userId), hasBribes = Object.entries(fu2.inventoryNames).some(([k]) => !(fu2.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
        const btnRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("refund_bribe").setLabel(hasBribes ? "💸 Bribe Epic Games" : "💸 No skins to bribe with").setStyle(ButtonStyle.Danger).setDisabled(!hasBribes), new ButtonBuilder().setCustomId("refund_request").setLabel("🙏 Request Anyway (33%)").setStyle(ButtonStyle.Secondary));
        await sel.update({ embeds: [new EmbedBuilder().setTitle("⚠️ Refund Warning").setDescription(`Refunding **${skin.name}**.\n\n💰 **Refund:** ${skin.price.toLocaleString()} V-Bucks\n\n> 💸 **Bribe Epic** — sacrifice a skin for guaranteed approval\n> 🙏 **Request Anyway** — 33% chance`).setColor(0xff0000).setTimestamp()], components: [btnRow] });
        const btnCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        btnCol.on("collect", async (btn) => {
          btnCol.stop("clicked"); const fu3 = getUser(userId); let approved = false, bribedSkin = null;
          if (btn.customId === "refund_bribe") {
            const bribes = Object.entries(fu3.inventoryNames).filter(([k]) => !(fu3.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
            if (!bribes.length) { await btn.update({ content: "❌ No skins to bribe with!", embeds: [], components: [] }); return; }
            const bribe = bribes[Math.floor(Math.random() * bribes.length)]; bribedSkin = bribe[1]; const bsId = bribe[0].replace(/_\d+$/, ""); const bIdx = fu3.inventory.indexOf(bsId); if (bIdx !== -1) fu3.inventory.splice(bIdx, 1); delete fu3.inventoryNames[bribe[0]]; approved = true;
          } else approved = Math.random() < 0.33;
          if (approved) {
            const refIdx = fu3.inventory.indexOf(skinId); if (refIdx !== -1) fu3.inventory.splice(refIdx, 1); delete fu3.inventoryNames[skin.nameKey]; fu3.shopSkins = (fu3.shopSkins ?? []).filter((s) => s !== skinId);
            addVbucks(userId, skin.price); updateUser(userId, { inventory: fu3.inventory, inventoryNames: fu3.inventoryNames, shopSkins: fu3.shopSkins });
            awardAchievement(userId, "epic_likes_you"); checkAndAwardAchievements(userId);
            await btn.update({ embeds: [new EmbedBuilder().setTitle("✅ Refund Approved!").setDescription(`✅ **Epic approved your refund** for **${skin.name}**!\n💰 **+${skin.price.toLocaleString()} V-Bucks**${bribedSkin ? `\n\n🤝 Bribed with **${bribedSkin}** — they took it immediately.` : ""}`).setColor(0x00ff00).setTimestamp()], components: [] });
          } else {
            const c2 = fu3.refundCooldowns ?? {}; c2[skinId] = Date.now(); updateUser(userId, { refundCooldowns: c2 }); awardAchievement(userId, "epic_hates_you");
            await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Refund Denied!").setDescription(`❌ **Epic rejected** your refund for **${skin.name}**.\n\nNo reason given. Try again in **4 hours**.`).setColor(0xff0000).setTimestamp()], components: [] });
          }
        });
      });
    },
  },

  // ── /hack ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("hack").setDescription("(Admin) Hack Epic Games to give a player 13,500 V-Bucks").addUserOption((o) => o.setName("player").setDescription("Player to give V-Bucks to").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const target = interaction.options.getUser("player", true);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💻 Hacking...").setDescription("```\nBypassing Epic Games firewall...\nAccessing V-Bucks database...\nInjecting payload...\n```").setColor(0x00ff00).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2500));
      addVbucks(target.id, 13500); addInteraction(target.id);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Hack Successful!").setDescription(`<@${target.id}> received **13,500 V-Bucks!**\n\n*Epic Games will never know.*`).setColor(0x00ff00).setTimestamp()] });
    },
  },

  // ── /freevbucks ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("freevbucks").setDescription("Claim free V-Bucks from a totally legit website!"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), lostAmount = Math.floor(user.vbucks * 0.25);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🤑 Free V-Bucks Generator — 100% LEGIT!!").setDescription("**Step 1:** Enter your login ✅\n**Step 2:** Select amount: **FREE** ✅\n**Step 3:** Waiting for verification...\n\n*Please wait up to 7 days for V-Bucks to arrive!*").setColor(0x00ff00).setFooter({ text: "freevbucks4real.biz • Totally not a virus" }).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 3000));
      addVbucks(userId, -lostAmount);
      const updated = getUser(userId), ach = awardAchievement(userId, "scammed");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("😱 A Week Later...").setDescription(`You entered your login like a genius and lost **${lostAmount.toLocaleString()} V-Bucks** — 25% of everything.\n\nhaha.\n\n💳 **New balance:** ${updated.vbucks.toLocaleString()} V-Bucks${updated.vbucks <= 0 ? " *(broke)*" : ""}`).setColor(0xff0000).setTimestamp(), ...(ach ? [buildAchievementEmbed(ach)] : [])] });
    },
  },

  // ── /creatorcode ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("creatorcode").setDescription("Support a creator for a discount on the Item Shop").addStringOption((o) => o.setName("code").setDescription("Creator code (leave blank to remove)").setRequired(false)),
    async execute(interaction) {
      const userId = interaction.user.id; addInteraction(userId);
      const rawInput = interaction.options.getString("code");
      if (!rawInput || rawInput.trim() === "") {
        const user = getUser(userId);
        if (!user.hasCreatorCode) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("ℹ️ No Creator Code Active").setDescription("Use `/creatorcode <code>` to support a creator!").setColor(0x888888).setTimestamp()] }); return; }
        updateUser(userId, { hasCreatorCode: false, creatorDiscount: 0, freeSkinExpiry: 0, freeSkinRedeemed: false });
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Creator Code Removed").setColor(0xff6600).setTimestamp()] }); return;
      }
      const code = rawInput.toLowerCase().trim(), match = VALID_CODES[code];
      if (!match) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❓ Unknown Creator Code").setDescription(`**${rawInput}** isn't valid. Try \`tylajadee\`, \`qckdream\`, or \`clovel\`!`).setColor(0xff6600).setTimestamp()] }); return; }
      const user = getUser(userId), discountPct = Math.round(match.discount * 100);
      const updates = { hasCreatorCode: true, creatorDiscount: match.discount };
      if (match.freeSkin && !((user.freeSkinExpiry ?? 0) > Date.now() && !(user.freeSkinRedeemed ?? false))) { updates.freeSkinExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; updates.freeSkinRedeemed = false; }
      updateUser(userId, updates);
      let desc = `You're supporting **${match.displayName}**! 🙌\n\n**${discountPct}% discount** on the Item Shop!`;
      if (match.freeSkin) desc += `\n\n🎁 **Perk — Free Skin Week!** Get **one FREE skin** from the shop!`;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎉 Creator Code Applied!").setDescription(desc).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /zeropoint ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("zeropoint").setDescription("Interact with the mysterious Zero Point orb"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const player = getUser(userId);
      updateUser(userId, { zeropointUses: (player.zeropointUses ?? 0) + 1 });
      const buildZPEmbed = () => new EmbedBuilder().setTitle("🔵 The Zero Point").setDescription(`*A mysterious orb crackling with energy...*\n\n✨ **Donate a skin** — always get a weapon in return!\n> ⚡ SMGs & ARs: **30% chance for 25 ammo** — fire all at once!\n> 🔫 Other weapons: 1 ammo\n\n🌟 **Donate Founders Pack** — receive **2,500 V-Bucks**\n\n🍀 **Feed Luck Potion** → **50%** chance to upgrade to Xtra Luck Potion\n🔮 **Feed Xtra Luck Potion** → **25%** chance to upgrade to Godly Luck Potion`).setColor(0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp();
      const buildZPRow = () => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("zp_donate_skin").setLabel("🎮 Donate a Skin").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("zp_donate_founders").setLabel(fu.hasFoundersPack ? "🌟 Donate Founders Pack (+2,500 V-Bucks)" : "🌟 No Founders Pack").setStyle(fu.hasFoundersPack ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!fu.hasFoundersPack),
          new ButtonBuilder().setCustomId("zp_luck_potion").setLabel(fu.luckPotion > 0 ? `🍀 Feed Luck Potion (${fu.luckPotion})` : "🍀 No Luck Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.luckPotion ?? 0) === 0),
          new ButtonBuilder().setCustomId("zp_xtra_potion").setLabel(fu.xtraLuckPotion > 0 ? `🔮 Feed Xtra Potion (${fu.xtraLuckPotion})` : "🔮 No Xtra Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.xtraLuckPotion ?? 0) === 0)
        );
      };
      const msg = await interaction.reply({ embeds: [buildZPEmbed()], components: [buildZPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        collector.stop("interacted");
        const cu = getUser(userId);
        if (btn.customId === "zp_luck_potion") {
          if ((cu.luckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { luckPotion: cu.luckPotion - 1 });
          if (roll(50)) { updateUser(userId, { xtraLuckPotion: (cu.xtraLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🌀 Success! Luck Potion → Xtra Luck Potion").setDescription("The **Zero Point** crackled with energy!\n\nYour **Luck Potion** transformed into an **Xtra Luck Potion**! 🔮").setFooter({ text: "50% chance — you got lucky!" }).setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** consumed your **Luck Potion**... the transformation failed.").setFooter({ text: "50% chance — better luck next time!" }).setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_xtra_potion") {
          if ((cu.xtraLuckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Xtra Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { xtraLuckPotion: cu.xtraLuckPotion - 1 });
          if (roll(25)) { updateUser(userId, { godlyLuckPotion: (cu.godlyLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⚡ GODLY! Xtra Luck Potion → Godly Luck Potion!").setDescription("The **Zero Point** ERUPTED!\n\nYour **Xtra Luck Potion** ascended into a **Godly Luck Potion**! ⚡").setFooter({ text: "25% chance — incredible!" }).setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** tried to ascend your **Xtra Luck Potion**... and failed.").setFooter({ text: "25% chance — keep trying!" }).setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_donate_founders") {
          if (!cu.hasFoundersPack) { await btn.update({ content: "❌ No Founders Pack!", embeds: [], components: [] }); return; }
          updateUser(userId, { hasFoundersPack: false }); addVbucks(userId, 2500);
          const after = getUser(userId);
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🌟 The Zero Point Accepts Your Offering!").setDescription(`You offered your **Founders Pack**.\n\nThe orb pulses with golden energy...\n\n💰 **+2,500 V-Bucks!**\n💳 **New balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks\n\n*Your Founders Pack was consumed.*`).setColor(0xffd700).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] }); return;
        }
        if (btn.customId === "zp_donate_skin") {
          const entries = Object.entries(cu.inventoryNames);
          if (!entries.length) { await btn.update({ content: "❌ You have no skins to donate!", embeds: [], components: [] }); return; }
          const skinOpts = entries.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🔵 Choose Your Offering").setDescription("The Zero Point awaits.\n\nSelect a skin to sacrifice for a weapon:").setColor(0x4444ff).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("zp_skin_select").setPlaceholder("Choose a skin to sacrifice...").addOptions(skinOpts))] });
          const skinCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId && i.customId === "zp_skin_select" });
          skinCol.on("collect", async (sel) => {
            skinCol.stop("selected");
            const key = sel.values[0], skinName = cu.inventoryNames[key] ?? key, skinId = key.replace(/_\d+$/, "");
            const fu2 = getUser(userId), idx = fu2.inventory.indexOf(skinId); if (idx !== -1) fu2.inventory.splice(idx, 1); delete fu2.inventoryNames[key];
            updateUser(userId, { inventory: fu2.inventory, inventoryNames: fu2.inventoryNames });
            const weapon = randomWeapon(), isMulti = isMultiAmmoWeapon(weapon), getsMulti = isMulti && Math.random() < 0.3, ammoCount = getsMulti ? 25 : 1;
            const fu3 = getUser(userId); updateUser(userId, { weapons: [...(fu3.weapons ?? []), ...Array(ammoCount).fill(weapon.name)] });
            await sel.update({ embeds: [new EmbedBuilder().setTitle(getsMulti ? `⚡ JACKPOT — ${weapon.name} × 25!` : `${weapon.emoji} The Zero Point Rewards You!`).setDescription(getsMulti ? `You sacrificed **${skinName}** to the Zero Point.\n\n${weapon.emoji} **You received: ${weapon.name} × 25 ammo!**\n*"${weapon.description}"*\n\n⚡ Use \`/attack @user ${weapon.name}\` to fire all 25 shots at once!` : `You sacrificed **${skinName}**.\n\n${weapon.emoji} **You received: ${weapon.name}** *(1 ammo)*\n*"${weapon.description}"*\n\nUse \`/attack @user ${weapon.name}\`!`).setColor(getsMulti ? 0xffd700 : 0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] });
          });
          skinCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ The Zero Point lost interest.", embeds: [], components: [] }).catch(() => {}); });
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /attack ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("attack").setDescription("Attack another player with a weapon from your arsenal").addUserOption((o) => o.setName("target").setDescription("Player to attack").setRequired(true)).addStringOption((o) => o.setName("weapon").setDescription("Weapon to use").setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction) => {
      const userId = interaction.user.id, user = getUser(userId), focused = interaction.options.getFocused().toLowerCase();
      const weapons = [...(user.weapons ?? [])], unique = [...new Set(weapons)];
      const choices = unique.filter((w) => w.toLowerCase().includes(focused)).slice(0, 25).map((w) => { const ammo = weapons.filter((x) => x === w).length; const wi = getWeaponByName(w); return { name: `${w} — ${ammo} ammo${wi && isMultiAmmoWeapon(wi) && ammo > 1 ? " (fires all)" : ""}`, value: w }; });
      await interaction.respond(choices);
    },
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("target", true), weaponInput = interaction.options.getString("weapon", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't attack yourself." }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Bots have unlimited HP." }); return; }
      const user = getUser(userId), weapons = [...(user.weapons ?? [])];
      const weaponName = weapons.find((w) => w.toLowerCase() === weaponInput.toLowerCase()) ?? null;
      if (!weaponName) { const owned = [...new Set(weapons)]; await interaction.editReply({ content: `❌ You don't have **${weaponInput}**.${owned.length ? `\n\n**Arsenal:** ${owned.join(", ")}` : "\n\n*No weapons. Use \`/zeropoint\` or \`/fish\`.*"}` }); return; }
      const weaponInfo = getWeaponByName(weaponName), emoji = weaponInfo?.emoji ?? "🔫", desc2 = weaponInfo?.description ?? "A powerful weapon.", isMulti = weaponInfo ? isMultiAmmoWeapon(weaponInfo) : false;
      const ammoCount = weapons.filter((w) => w.toLowerCase() === weaponName.toLowerCase()).length, usedAmmo = isMulti ? ammoCount : 1;
      const newWeapons = [...weapons]; let removed = 0;
      for (let i = newWeapons.length - 1; i >= 0 && removed < usedAmmo; i--) { if (newWeapons[i].toLowerCase() === weaponName.toLowerCase()) { newWeapons.splice(i, 1); removed++; } }
      updateUser(userId, { weapons: newWeapons });
      const HIT_CHANCE = 0.25;
      const targetUser = getUser(target.id);
      const hasShield = (targetUser.buildCharges ?? 0) > 0;
      if (isMulti && usedAmmo > 1) {
        let hits = 0, misses = 0;
        for (let i = 0; i < usedAmmo; i++) { if (Math.random() < HIT_CHANCE) hits++; else misses++; }
        // Absorb hits with build charges
        let shieldAbsorbed = 0;
        if (hasShield && hits > 0) {
          shieldAbsorbed = Math.min(hits, targetUser.buildCharges);
          hits -= shieldAbsorbed;
          const newCharges = targetUser.buildCharges - shieldAbsorbed;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        const shieldLine = shieldAbsorbed > 0 ? `\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed ${shieldAbsorbed} hit(s)!**` : "";
        if (hits > 0) {
          const elimMs = Math.min(hits * 10 * 60 * 1000, 120 * 60 * 1000);
          const existing = (getUser(target.id).eliminatedUntil ?? 0) > Date.now() ? getUser(target.id).eliminatedUntil : Date.now();
          updateUser(target.id, { eliminatedUntil: existing + elimMs });
          const totalMins = Math.round(elimMs / 60000);
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} unloaded on ${target.username}!`).setDescription(`Fired **${usedAmmo} rounds** of **${weaponName}**!\n\n📊 **${hits} hit(s), ${misses} miss(es)** *(+${shieldAbsorbed} blocked)*${shieldLine}\n\n☠️ **${target.username}** eliminated for **${totalMins} minutes!**\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} missed every shot!`).setDescription(`Fired **${usedAmmo} rounds**... **0 hits, ${misses} misses.**${shieldLine}\n\n🔫 All ammo wasted.`).setColor(0x888888).setTimestamp()] });
        }
      } else {
        const hit = Math.random() < HIT_CHANCE;
        let blocked = false;
        if (hit && hasShield) {
          blocked = true;
          const newCharges = targetUser.buildCharges - 1;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        if (hit && !blocked) {
          updateUser(target.id, { eliminatedUntil: Date.now() + 10 * 60 * 1000 });
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Direct Hit!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n💥 **ELIMINATED!** ${target.username} can't interact for **10 minutes**.\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else if (blocked) {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Hit Blocked!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed the shot!**\n\nOne build charge consumed. 🔫`).setColor(0x888888).setTimestamp()] });
        } else {
          const mm = ["missed every shot", "forgot to take the safety off", "aimed for the head and hit a tree"][Math.floor(Math.random() * 3)];
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Missed!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**...\n\n*"${desc2}"*\n\n💨 **MISSED!** ${interaction.user.username} ${mm}.\n\n🔫 **${weaponName}** consumed.`).setColor(0x888888).setTimestamp()] });
        }
      }
    },
  },

  // ── /reboot ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("reboot").setDescription("Reboot a downed player for 299 V-Bucks").addUserOption((o) => o.setName("player").setDescription("Player to reboot").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.editReply({ content: "❌ Can't reboot a bot." }); return; }
      if (!isEliminated(target.id)) { await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Player is Alive").setDescription(`**${target.username}** is not downed!`).setColor(0x00ff00).setTimestamp()] }); return; }
      const cu = getUser(userId);
      if (!cu.infiniteVbucks && cu.vbucks < 299) { await interaction.editReply({ content: `❌ Need **299 V-Bucks** to reboot.` }); return; }
      if (!cu.infiniteVbucks) addVbucks(userId, -299);
      updateUser(target.id, { eliminatedUntil: 0 });
      const after = getUser(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Player Rebooted!").setDescription(`**${interaction.user.username}** spent **299 V-Bucks** to reboot **${target.username}**!\n\n${target.username} is back!\n\n💳 **Your balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /useluckpotion (can target others) ───
  {
    data: new SlashCommandBuilder().setName("useluckpotion").setDescription("Use a luck potion on yourself or another player!").addStringOption((o) => o.setName("type").setDescription("Which luck potion?").setRequired(true).addChoices({ name: "🍀 Luck Potion (+15%)", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion (+40%)", value: "xtraLuckPotion" }, { name: "⚡ Godly Luck Potion (+80%)", value: "godlyLuckPotion" })).addUserOption((o) => o.setName("player").setDescription("Player to give the luck boost to (default: yourself)").setRequired(false)),
    async execute(interaction) {
      const type = interaction.options.getString("type");
      const targetUser = interaction.options.getUser("player") ?? interaction.user;
      const userId = interaction.user.id;
      const player = getUser(userId);
      const names = { luckPotion: "Luck Potion", xtraLuckPotion: "Xtra Luck Potion", godlyLuckPotion: "Godly Luck Potion" };
      if ((player[type] ?? 0) <= 0) { await interaction.reply({ content: `❌ You don't have any **${names[type]}**!`, ephemeral: true }); return; }
      const targetId = targetUser.id;
      const isSelf = targetId === userId;
      const luckKey = type === "luckPotion" ? "normal" : type === "xtraLuckPotion" ? "xtra" : "godly";
      player[type]--;
      updateUser(targetId, { activeLuck: luckKey });
      const INFO = { normal: { emoji: "🍀", label: "Luck Potion", boost: "+15%", color: "#2ecc71" }, xtra: { emoji: "🔮", label: "Xtra Luck Potion", boost: "+40%", color: "#9b59b6" }, godly: { emoji: "⚡", label: "Godly Luck Potion", boost: "+80%", color: "#f1c40f" } };
      const info = INFO[luckKey];
      const targetData = getUser(targetId);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} ${info.label} Activated!`).setDescription(isSelf ? `All your luck-based chances boosted by **${info.boost}**!` : `You gifted your **${info.label}** to <@${targetId}>!\n\nTheir luck-based chances are boosted by **${info.boost}**!`).addFields({ name: "God Chest Chance", value: `${boostedChance(5, luckKey)}%`, inline: true }, { name: "Inf V-Bucks Chance", value: `${boostedChance(15, luckKey)}%`, inline: true }, { name: "10k V-Bucks Chance", value: `${boostedChance(25, luckKey)}%`, inline: true }).setFooter({ text: isSelf ? "Active on yourself" : `Active on ${targetUser.username}` })] });
      if (!isSelf && interaction.channel?.send) await interaction.channel.send({ content: `<@${targetId}>`, embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} You received a Luck Boost!`).setDescription(`<@${userId}> used their **${info.label}** on you!\n\nYour luck-based chances are boosted by **${info.boost}**!`)] });
    },
  },

  // ── /skinalogue ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("skinalogue").setDescription("Browse all catchable Fortnite skins").addStringOption((o) => o.setName("search").setDescription("Filter by name").setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply();
      const query = (interaction.options.getString("search") ?? "").trim().toLowerCase();
      const allSkins = await fetchFortniteSkins(), filtered = query ? allSkins.filter((s) => s.name.toLowerCase().includes(query)) : allSkins;
      let page = 0;
      const buildSkinPage = (p) => {
        const total = filtered.length, totalPages = Math.max(1, Math.ceil(total / 8)), safePage = Math.min(p, totalPages - 1);
        const slice = filtered.slice(safePage * 8, safePage * 8 + 8);
        const embed = new EmbedBuilder().setTitle(query ? `📖 Skinalogue — "${query}"` : "📖 Skinalogue — All Skins").setDescription(total === 0 ? `No skins found for **"${query}"**.` : slice.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · *${s.rarity}* · \`${getSpawnPercent(s.rarity)}%\` spawn`).join("\n")).setColor(0x00d4ff).setFooter({ text: total === 0 ? "No results" : `Page ${safePage + 1} of ${totalPages} • ${total} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`skin_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0 || total === 0), new ButtonBuilder().setCustomId(`skin_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1 || total === 0));
        return { embed, row, totalPages, safePage };
      };
      const { embed, row } = buildSkinPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      if (!filtered.length) return;
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === interaction.user.id });
      collector.on("collect", async (btn) => {
        const { totalPages, safePage } = buildSkinPage(page);
        if (btn.customId === "skin_prev") page = Math.max(0, safePage - 1); else page = Math.min(totalPages - 1, safePage + 1);
        await btn.update({ ...buildSkinPage(page) });
      });
      collector.on("end", async () => { const { embed: e } = buildSkinPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ═══════════════ NEW COMMANDS ═══════════════

  // ── /llama ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("llama").setDescription("Open a Supply Llama! 1-hour cooldown — great random rewards inside"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 60 * 60 * 1000;
      const last = user.lastLlama ?? 0;
      if (now - last < cooldown) {
        const left = cooldown - (now - last), h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 No Llamas Available").setDescription(`The next Supply Llama spawns in:\n\n⏳ **${h > 0 ? h + "h " : ""}${m}m ${s}s**\n\n*Llamas are rare! Come back soon.*`).setColor(0x888888).setImage(LLAMA_IMAGE).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 A Supply Llama appeared!").setDescription("You spotted a **Supply Llama** grazing nearby...\n\nPicking the locks...").setColor(0xf4a01a).setImage(LLAMA_IMAGE).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2000));
      updateUser(userId, { lastLlama: now, llamaOpens: (user.llamaOpens ?? 0) + 1 });
      const luck = user.activeLuck;
      // Loot table (weighted)
      const LLAMA_TABLE = [
        { weight: 20, fn: () => { addVbucks(userId, 200); return { desc: "💰 **200 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 15, fn: () => { addVbucks(userId, 500); return { desc: "💰 **500 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 10, fn: () => { addVbucks(userId, 1000); return { desc: "💰 **1,000 V-Bucks!**", color: 0xf4a01a }; } },
        { weight: 15, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons ?? []), w.name] }); return { desc: `${w.emoji} **${w.name}** *(weapon)!*`, color: 0xff6600 }; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes ?? 0) + 2 }); return { desc: "📦 **2 STW Boxes**!", color: 0xff6600 }; } },
        { weight: 8,  fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion ?? 0) + 1 }); return { desc: "🍀 **Luck Potion**!", color: 0x2ecc71 }; } },
        { weight: 6,  fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion ?? 0) + 1 }); return { desc: "🔮 **Xtra Luck Potion**!", color: 0x9b4dca }; } },
        { weight: boostedChance(4, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return { desc: `${getRarityEmoji(skin.rarity)} **${skin.name}** *(${skin.rarity} skin!)* 🎮`, color: getRarityColor(skin.rarity), image: skin.imageUrl }; } },
        { weight: boostedChance(3, luck), fn: () => { updateUser(userId, { foundersBoxes: (getUser(userId).foundersBoxes ?? 0) + 1 }); return { desc: "📦 **Founders Box!**", color: 0xffd700 }; } },
        { weight: boostedChance(2, luck), fn: () => { updateUser(userId, { godChest: (getUser(userId).godChest ?? 0) + 1 }); return { desc: "🌟 **GOD CHEST!** Extremely rare!", color: 0xffd700 }; } },
      ];
      const total = LLAMA_TABLE.reduce((a, b) => a + b.weight, 0);
      let r = Math.random() * total;
      let chosen = LLAMA_TABLE[0];
      for (const item of LLAMA_TABLE) { r -= item.weight; if (r <= 0) { chosen = item; break; } }
      const result = await chosen.fn();
      checkAndAwardAchievements(userId);
      const embed = new EmbedBuilder().setTitle("🦙 Supply Llama Opened!").setDescription(`You cracked open the **Supply Llama** and found...\n\n${result.desc}\n\n+50 XP earned!`).setColor(result.color).setFooter({ text: "Next llama available in 1 hour" }).setTimestamp();
      if (result.image) embed.setThumbnail(result.image);
      addXP(userId, 50);
      const godChestRow = result.desc.includes("GOD CHEST") ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("llama_open_godchest").setLabel("🌟 Open God Chest!").setStyle(ButtonStyle.Success)) : null;
      await interaction.editReply({ embeds: [embed], ...(godChestRow ? { components: [godChestRow] } : {}) });
      if (godChestRow) {
        const gcMsg = await interaction.fetchReply();
        const gcCol = gcMsg.createMessageComponentCollector({ time: 60000 });
        gcCol.on("collect", async (btn) => {
          if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
          await openGodChestInteraction(btn, userId); gcCol.stop();
        });
        gcCol.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
      }
    },
  },

  // ── /fish ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("fish").setDescription("Grab your fishing rod and head to a named location! 15-minute cooldown").addStringOption((o) => o.setName("location").setDescription("Where to fish").setRequired(false).addChoices(...FISH_SPOTS.slice(0, 10).map((s) => ({ name: s, value: s })))),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 15 * 60 * 1000;
      if (now - (user.lastFish ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastFish ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎣 Still Fishing...").setDescription(`You just went fishing! Wait **${m}m ${s}s** before going again.\n\n*The fish need time to respawn!*`).setColor(0x888888).setTimestamp()] }); return;
      }
      const spot = interaction.options.getString("location") ?? FISH_SPOTS[Math.floor(Math.random() * FISH_SPOTS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎣 Fishing at ${spot}...`).setDescription("You cast your line into the water...\n\n*Waiting for a bite...*").setColor(0x0075e3).setTimestamp()] });
      const waitMs = 1500 + Math.random() * 2500;
      await new Promise((r) => setTimeout(r, waitMs));
      const catch_ = weightedFish();
      const resultDesc = catch_.action(userId);
      updateUser(userId, { lastFish: now, fishCaught: (user.fishCaught ?? 0) + 1 });
      addXP(userId, 60);
      checkAndAwardAchievements(userId);
      if (catch_.name === "Mythic Goldfish") awardAchievement(userId, "goldfish");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${catch_.emoji} You caught a ${catch_.name}!`).setDescription(`Fishing at **${spot}**...\n\n${resultDesc}!\n\n+60 XP earned!`).setColor(catch_.name === "Junk" ? 0x888888 : catch_.name === "Mythic Goldfish" ? 0xffd700 : 0x0075e3).setFooter({ text: "Next fishing trip in 15 minutes" }).setTimestamp()] });
    },
  },

  // ── /battlepass ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("battlepass").setDescription("View your Battle Pass progress and tier rewards"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const tier = getBattlePassTier(user.level, user.xp);
      const earnedRewards = BP_REWARDS.filter((r) => tier >= r.tier);
      const nextReward = BP_REWARDS.find((r) => r.tier > tier);
      const bar = "█".repeat(Math.round((tier / 100) * 20)) + "░".repeat(20 - Math.round((tier / 100) * 20));
      const rewardLines = BP_REWARDS.map((r) => `${tier >= r.tier ? "✅" : "🔒"} **Tier ${r.tier}:** ${r.reward}`);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎮 ${interaction.user.username}'s Battle Pass`).setDescription(`**Tier:** ${tier}/100\n\`${bar}\`\n\n${nextReward ? `**Next reward at Tier ${nextReward.tier}:** ${nextReward.reward}\n*Earn XP to level up your Battle Pass tier!*` : "🏆 **BATTLE PASS COMPLETE!**"}\n\n**All Rewards:**\n${rewardLines.join("\n")}`).setColor(tier >= 100 ? 0xffd700 : tier >= 50 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "Tier increases with bot level & XP" }).setTimestamp()] });
      if (tier >= 100) checkAndAwardAchievements(userId);
    },
  },

  // ── /stormwatch ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("stormwatch").setDescription("Check the storm — you might be safe, or you might be in it! 10-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 10 * 60 * 1000;
      if (now - (user.lastStorm ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastStorm ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Storm Already Checked").setDescription(`You already checked the storm recently.\n\nWait **${m}m ${s}s** before checking again.`).setColor(0x888888).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Checking Storm Position...").setDescription("Pulling up the storm map...\n\n*Triangulating your position...*").setColor(0x888888).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 1500));
      const event = rollStorm();
      const result = event.fn(userId);
      updateUser(userId, { lastStorm: now });
      if (event.name.includes("Safe") || event.name.includes("Eye")) {
        updateUser(userId, { stormsSurvived: (user.stormsSurvived ?? 0) + 1 });
        checkAndAwardAchievements(userId);
      }
      const pos = FORTNITE_POIS[Math.floor(Math.random() * FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🌪️ Storm Report — ${event.name}`).setDescription(`📍 **Your location:** ${pos}\n\n${result}!\n\n⏰ **Next circle closes in:** ${Math.floor(Math.random() * 3) + 1}m 30s`).setColor(event.color).setFooter({ text: "Next storm check in 10 minutes" }).setTimestamp()] });
    },
  },

  // ── /supply_drop ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("supply_drop").setDescription("Call in a Supply Drop from the Battle Bus! 30-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 30 * 60 * 1000;
      if (now - (user.lastSupplyDrop ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastSupplyDrop ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop On Cooldown").setDescription(`A drop was already called. Next one in:\n\n⏳ **${m}m ${s}s**`).setColor(0x888888).setTimestamp()] }); return;
      }
      const location = FORTNITE_POIS[Math.floor(Math.random() * FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Incoming!").setDescription(`A Supply Drop was spotted over **${location}**!\n\n*Balloon descending...*`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setTimestamp()] });
      const landMs = 2000 + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, landMs));
      updateUser(userId, { lastSupplyDrop: now, supplyDrops: (user.supplyDrops ?? 0) + 1 });
      const luck = user.activeLuck;
      const DROP_TABLE = [
        { weight: 25, fn: () => { addVbucks(userId, 300); return "💰 **300 V-Bucks**"; } },
        { weight: 20, fn: () => { addVbucks(userId, 750); return "💰 **750 V-Bucks**"; } },
        { weight: 20, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons ?? []), w.name, w.name] }); return `${w.emoji} **${w.name} × 2 ammo**`; } },
        { weight: 15, fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion ?? 0) + 1 }); return "🍀 **Luck Potion**"; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes ?? 0) + 1 }); return "📬 **STW Box**"; } },
        { weight: boostedChance(5, luck), fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion ?? 0) + 1 }); return "🔮 **Xtra Luck Potion!**"; } },
        { weight: boostedChance(3, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return `${getRarityEmoji(skin.rarity)} **${skin.name}** *(skin!)*`; } },
      ];
      const dtTotal = DROP_TABLE.reduce((a, b) => a + b.weight, 0);
      let dr = Math.random() * dtTotal, chosenDrop = DROP_TABLE[0];
      for (const d of DROP_TABLE) { dr -= d.weight; if (dr <= 0) { chosenDrop = d; break; } }
      const dropResult = await chosenDrop.fn();
      addXP(userId, 75); checkAndAwardAchievements(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Landed!").setDescription(`The drop landed in **${location}** — you reached it first!\n\nInside the crate:\n\n${dropResult}!\n\n+75 XP earned!`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setFooter({ text: "Next supply drop in 30 minutes" }).setTimestamp()] });
    },
  },

  // ── /build ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("build").setDescription("Build a structure for protection — each material blocks a set number of attacks").addStringOption((o) => o.setName("material").setDescription("Building material").setRequired(true).addChoices({ name: "🪵 Wood — 50 V-Bucks (1 hit)", value: "wood" }, { name: "🧱 Brick — 125 V-Bucks (2 hits)", value: "brick" }, { name: "⚙️ Metal — 250 V-Bucks (3 hits)", value: "metal" })),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const material = interaction.options.getString("material");
      const mat = BUILD_MATS[material];
      const user = getUser(userId);
      if (!user.infiniteVbucks && user.vbucks < mat.cost) {
        await interaction.reply({ content: `❌ Need **${mat.cost} V-Bucks** to build with **${mat.label}**. You have **${user.vbucks.toLocaleString()}**.` }); return;
      }
      if (!user.infiniteVbucks) addVbucks(userId, -mat.cost);
      updateUser(userId, { buildCharges: mat.charges, buildMaterial: material, timesBuilt: (user.timesBuilt ?? 0) + 1 });
      addXP(userId, 30); checkAndAwardAchievements(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Structure Built — ${mat.label}!`).setDescription(`You built a **${mat.label}** structure!\n\n${mat.desc}\n\n> Each incoming hit will consume 1 charge before dealing damage.\n> When charges run out, the structure collapses.\n\n💳 **V-Bucks spent:** ${mat.cost.toLocaleString()}\n🏗️ **Charges:** ${mat.charges}`).setColor(material === "wood" ? 0x8b4513 : material === "brick" ? 0xb05020 : 0x708090).setFooter({ text: "Build charges persist until consumed" }).setTimestamp()] });
    },
  },

  // ── /medkit ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("medkit").setDescription("Use a medkit to cut your elimination time in half (costs 100 V-Bucks)"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!isEliminated(userId)) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ You're Not Eliminated!").setDescription("You don't need a medkit — you're alive!\n\nUse one when you're eliminated by another player.").setColor(0x00ff00).setTimestamp()] }); return; }
      const cost = 100;
      if (!user.infiniteVbucks && user.vbucks < cost) { await interaction.reply({ content: `❌ Need **${cost} V-Bucks** for a medkit. You have **${user.vbucks.toLocaleString()}**.` }); return; }
      const timeLeft = getEliminationTimeLeft(userId);
      const newTime = Math.floor(timeLeft / 2);
      const newElimUntil = Date.now() + newTime;
      if (!user.infiniteVbucks) addVbucks(userId, -cost);
      updateUser(userId, { eliminatedUntil: newElimUntil });
      addXP(userId, 25);
      const minsLeft = Math.ceil(newTime / 60000);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💊 Medkit Used!").setDescription(`You used a **medkit**! Your elimination time was cut in half.\n\n⏳ **Time remaining:** ${minsLeft} minute${minsLeft !== 1 ? "s" : ""}\n💳 **V-Bucks spent:** ${cost}\n\n*Ask someone to \`/reboot\` you to clear it entirely!*`).setColor(0x2ecc71).setFooter({ text: "Self-heal in action" }).setTimestamp()] });
    },
  },

  // ── /spy ─────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("spy").setDescription("Spy on another player to see their public bot stats").addUserOption((o) => o.setName("player").setDescription("Player to spy on").setRequired(true)),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.reply({ content: "❌ Can't spy on a bot — they have no stats." }); return; }
      const targetData = getUser(target.id);
      const tier = getBattlePassTier(targetData.level, targetData.xp);
      const eliminated = isEliminated(target.id);
      const timeLeft = eliminated ? Math.ceil(getEliminationTimeLeft(target.id) / 60000) : 0;
      const matInfo = targetData.buildCharges > 0 ? `${BUILD_MATS[targetData.buildMaterial]?.label ?? "🪵 Wood"} (${targetData.buildCharges} charge${targetData.buildCharges !== 1 ? "s" : ""})` : "None";
      const vbDisplay = targetData.infiniteVbucks ? "∞ (Infinite!)" : `~${Math.floor(targetData.vbucks / 500) * 500}+`; // Approximate V-Bucks, not exact
      const spyActions = ["hacked a satellite dish", "bribed a llama", "intercepted their signals", "found their trophy case", "checked their Fortnite locker"];
      const spyFlavor = spyActions[Math.floor(Math.random() * spyActions.length)];
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🕵️ Intel Report — ${target.username}`).setDescription(`*You ${spyFlavor} and uncovered the following intelligence:*\n\n📊 **Level:** ${targetData.level}\n🎮 **Battle Pass Tier:** ${tier}/100\n🎒 **Skins:** ${targetData.inventory.length}\n💰 **V-Bucks (approx):** ${vbDisplay}\n🔥 **Daily Streak:** ${targetData.dailyStreak ?? 0} days\n🏗️ **Build:** ${matInfo}\n🪙 **Coin Flip W/L:** ${targetData.coinflipsWon ?? 0} wins\n${eliminated ? `\n☠️ **Status:** ELIMINATED (${timeLeft} min left)` : "\n✅ **Status:** Active in game"}\n\n*Stats may be incomplete due to encryption.*`).setColor(0x2c2c2c).setThumbnail(target.displayAvatarURL()).setFooter({ text: `Spy report • ${interaction.user.username}` }).setTimestamp()] });
    },
  },

  // ── /duel ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("duel").setDescription("Challenge someone to a 1v1 skin or V-Bucks duel!").addUserOption((o) => o.setName("player").setDescription("Player to duel").setRequired(true)).addStringOption((o) => o.setName("wager").setDescription("What to wager").setRequired(false).addChoices({ name: "💰 V-Bucks (500)", value: "vbucks" }, { name: "🎮 A Skin from inventory", value: "skin" })),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const wagerType = interaction.options.getString("wager") ?? "vbucks";
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't duel yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't duel bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId), targetData = getUser(target.id);
      updateUser(userId, { duelsPlayed: (challenger.duelsPlayed ?? 0) + 1 });
      if (wagerType === "vbucks") {
        const amount = 500;
        if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.editReply({ content: `❌ Need **${amount} V-Bucks** to duel.` }); return; }
        if (!targetData.infiniteVbucks && targetData.vbucks < amount) { await interaction.editReply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
        const embed = new EmbedBuilder().setTitle("⚔️ Duel Challenge!").setDescription(`<@${userId}> challenged <@${target.id}> to a **1v1 duel!**\n\n💰 **Wager:** 500 V-Bucks each\n🏆 **Winner takes:** 1,000 V-Bucks\n\n<@${target.id}>, do you accept?`).setColor(0xff4444).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_accept_${userId}`).setLabel("⚔️ Accept").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`duel_decline_${userId}`).setLabel("🏳️ Decline").setStyle(ButtonStyle.Secondary));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id });
        collector.on("collect", async (btn) => {
          if (btn.customId.includes("decline")) { await btn.update({ embeds: [new EmbedBuilder().setTitle("🏳️ Duel Declined").setDescription(`<@${target.id}> backed down!`).setColor(0x888888).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
          collector.stop("accepted");
          await btn.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Duel in Progress!").setDescription("```\nCountdown: 3...\n2...\n1...\nFIRE!\n```").setColor(0xff4444).setTimestamp()], components: [] });
          await new Promise((r) => setTimeout(r, 2500));
          const cLuck = LUCK_BOOST[challenger.activeLuck] ?? 0, tLuck = LUCK_BOOST[targetData.activeLuck] ?? 0;
          const cScore = Math.random() * 100 + cLuck, tScore = Math.random() * 100 + tLuck;
          const winnerId = cScore > tScore ? userId : target.id, loserId = winnerId === userId ? target.id : userId;
          if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
          addVbucks(winnerId, amount); addXP(winnerId, 150);
          awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
          const winner = getUser(winnerId), loser = getUser(loserId);
          const moves = ["landed a perfect headshot", "built a 90 and edited out", "pump-sniped from 200m", "hit every shot with the Stinger", "RNG blessed them"];
          const move = moves[Math.floor(Math.random() * moves.length)];
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Duel Over — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** ${move} and eliminated **<@${loserId}>**!\n\n🏆 **+${amount} V-Bucks** to the winner!\n💸 **-${amount} V-Bucks** from the loser\n\n${cLuck !== tLuck ? `> Luck difference: ${cLuck > tLuck ? `<@${userId}> had +${cLuck}% luck advantage` : `<@${target.id}> had +${tLuck}% luck advantage`}` : ""}`).setColor(0xffd700).setTimestamp()], content: "" });
        });
        collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      } else {
        // Skin duel
        const challSkins = Object.entries(challenger.inventoryNames), targSkins = Object.entries(targetData.inventoryNames);
        if (!challSkins.length) { await interaction.editReply({ content: "❌ You have no skins to wager." }); return; }
        if (!targSkins.length) { await interaction.editReply({ content: `❌ <@${target.id}> has no skins to wager.` }); return; }
        const challOpts = challSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> challenged <@${target.id}> to a **skin duel**!\n\n<@${userId}>, pick a skin to wager first.`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_challenger").setPlaceholder("Pick your skin...").addOptions(challOpts))] });
        let challPick = null, targPick = null;
        const collector2 = msg.createMessageComponentCollector({ time: 2 * 60 * 1000, filter: (i) => i.user.id === userId || i.user.id === target.id });
        collector2.on("collect", async (i) => {
          if (i.isStringSelectMenu() && i.customId === "duel_skin_challenger" && i.user.id === userId) {
            challPick = { key: i.values[0], name: challenger.inventoryNames[i.values[0]] };
            const targOpts = targSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> wagers **${challPick.name}**!\n\n<@${target.id}>, pick your skin to wager:`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_target").setPlaceholder("Pick your skin...").addOptions(targOpts))] }); return;
          }
          if (i.isStringSelectMenu() && i.customId === "duel_skin_target" && i.user.id === target.id) {
            targPick = { key: i.values[0], name: targetData.inventoryNames[i.values[0]] };
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`**<@${userId}>** wagers **${challPick.name}**\n**<@${target.id}>** wagers **${targPick.name}**\n\n*The duel begins...*`).setColor(0xff0000).setTimestamp()], components: [] });
            await new Promise((r) => setTimeout(r, 2500));
            const cLuck = LUCK_BOOST[challenger.activeLuck] ?? 0, tLuck = LUCK_BOOST[targetData.activeLuck] ?? 0;
            const cScore = Math.random() * 100 + cLuck, tScore = Math.random() * 100 + tLuck;
            const [winnerId, loserId, winnerPick, loserPick] = cScore > tScore ? [userId, target.id, targPick, challPick] : [target.id, userId, challPick, targPick];
            const winnerData = getUser(winnerId), loserData = getUser(loserId);
            const idx = loserData.inventory.indexOf(loserPick.key.replace(/_\d+$/, "")); if (idx !== -1) loserData.inventory.splice(idx, 1); delete loserData.inventoryNames[loserPick.key];
            addSkinToInventory(winnerId, loserPick.key.replace(/_\d+$/, ""), loserPick.name);
            awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Skin Duel — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** outplayed **<@${loserId}>**!\n\n🏆 **<@${winnerId}>** receives **${loserPick.name}**!\n\n*Check \`/inventory\` to see your new skin.*`).setColor(0xffd700).setTimestamp()], content: "" });
            collector2.stop("done");
          }
        });
        collector2.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      }
    },
  },
];

// ─────────────────────────────────────────────
//  Command registration + Discord client
// ─────────────────────────────────────────────
const commandMap = new Map(commands.map((c) => [c.data.name, c]));

async function registerCommands(token, clientId) {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const body = commands.map((c) => c.data.toJSON());

    // Multi-guild support
    const guildIdsRaw = process.env.GUILD_IDS;

    if (guildIdsRaw) {
      const guildIds = guildIdsRaw
        .split(",")
        .map(id => id.trim())
        .filter(Boolean);

      // Clear + register each guild
      for (const guildId of guildIds) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: [] }
        );

        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body }
        );

        console.log(`✅ Registered ${body.length} commands for guild ${guildId}`);
      }
    } else {
      // Global fallback
      await rest.put(
        Routes.applicationCommands(clientId),
        { body }
      );

      console.log(`✅ Registered ${body.length} global commands`);
    }
  } catch (err) {
    console.error("❌ Registration failed:", err);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID || client.user.id;
  const guildId = process.env.DISCORD_GUILD_ID;
  await registerCommands(token, clientId, guildId);
  try { await fetchFortniteSkins(); console.log("✅ Fortnite skins loaded"); } catch (err) { console.warn("⚠️ Could not pre-load skins:", err.message); }
  initSpawner(client);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) { const cmd = commandMap.get(interaction.commandName); if (cmd?.autocomplete) await cmd.autocomplete(interaction); return; }
    if (!interaction.isChatInputCommand()) return;
    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) return;
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Command error [${interaction.commandName}]:`, err);
    const msg = { content: "❌ Something went wrong!", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() === "buy") await handleBuyMessage(message).catch(console.error);
});

client.on("error", (err) => console.error("Discord client error:", err));

const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (token) client.login(token).catch((err) => console.error("❌ Discord login failed:", err.message));
else console.warn("⚠️ No DISCORD_TOKEN — Express server running but bot is offline.");

process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
  { id: "pump_shotgun",     name: "Pump Shotgun",            emoji: "🔫", type: "shotgun",   description: "One pump — if it lands."              },
  { id: "heavy_sniper",     name: "Heavy Sniper Rifle",       emoji: "🎯", type: "sniper",    description: "Walls? What walls?"                   },
  { id: "scar",             name: "SCAR",                     emoji: "⚡", type: "ar",        description: "The gold standard of ARs."            },
  { id: "rocket_launcher",  name: "Rocket Launcher",          emoji: "🚀", type: "explosive", description: "Shoot first, aim never."              },
  { id: "bolt_sniper",      name: "Bolt-Action Sniper Rifle", emoji: "🎯", type: "sniper",    description: "Patience is a virtue."                },
  { id: "hand_cannon",      name: "Hand Cannon",              emoji: "🔫", type: "pistol",    description: "A pistol with stopping power."        },
  { id: "combat_shotgun",   name: "Combat Shotgun",           emoji: "💥", type: "shotgun",   description: "Fast fire, no mercy."                 },
  { id: "grenade_launcher", name: "Grenade Launcher",         emoji: "💣", type: "explosive", description: "Indirect fire specialist."            },
  { id: "stinger_smg",      name: "Stinger SMG",              emoji: "⚡", type: "smg",       description: "Up close and very personal."          },
  { id: "thermal_scoped",   name: "Thermal Scoped AR",        emoji: "🔭", type: "ar",        description: "Nobody hides from this."              },
  { id: "rapid_fire_smg",   name: "Rapid Fire SMG",           emoji: "💨", type: "smg",       description: "Half the accuracy, twice the panic."  },
  { id: "mythic_goldfish",  name: "Mythic Goldfish",           emoji: "🐟", type: "special",   description: "It's a fish. A very powerful fish."  },
  { id: "flint_knock",      name: "Flintlock Pistol",         emoji: "🔫", type: "pistol",    description: "Knocks them back to the Stone Age."  },
  { id: "minigun",          name: "Minigun",                  emoji: "🔥", type: "ar",        description: "Sustained fire destroyer."            },
  { id: "shockwave_launcher", name: "Shockwave Launcher",     emoji: "💫", type: "explosive", description: "Not lethal. Just humiliating."        },
];
const MULTI_AMMO_TYPES = new Set(["smg", "ar"]);
function isMultiAmmoWeapon(w) { return MULTI_AMMO_TYPES.has(w.type); }
function getWeaponByName(name) {
  const q = name.toLowerCase().trim();
  return FORTNITE_WEAPONS.find((w) => w.name.toLowerCase() === q || w.id === q || w.name.toLowerCase().includes(q));
}
function randomWeapon() { return FORTNITE_WEAPONS[Math.floor(Math.random() * FORTNITE_WEAPONS.length)]; }

const RARITY_WEIGHTS = { legendary: 5, epic: 10, rare: 20, uncommon: 30, common: 35 };

// Fishing spots + results
const FISH_SPOTS = ["Pleasant Park", "Lazy Lake", "Tilted Towers", "Slurpy Swamp", "Misty Meadows", "Coral Castle", "Holly Hatchery", "Dirty Docks", "Steamy Stacks"];
const FISH_TABLE = [
  { name: "Small Fry",      emoji: "🐟", weight: 30, action: (uid) => { addXP(uid, 75); return "A tiny **Small Fry**! +75 XP"; } },
  { name: "Flopper",        emoji: "🐠", weight: 25, action: (uid) => { addVbucks(uid, 200); return "A **Flopper**! +200 V-Bucks"; } },
  { name: "Slurpfish",      emoji: "🐡", weight: 15, action: (uid) => { addXP(uid, 200); addVbucks(uid, 100); return "A **Slurpfish**! +200 XP + 100 V-Bucks"; } },
  { name: "Shield Fish",    emoji: "🛡️", weight: 10, action: (uid) => { const u = getUser(uid); updateUser(uid, { buildCharges: (u.buildCharges||0)+1, buildMaterial: u.buildMaterial==="none" ? "wood" : u.buildMaterial }); return "A **Shield Fish**! +1 build charge to your structure"; } },
  { name: "Mythic Goldfish", emoji: "✨", weight: 3,  action: (uid) => { const u = getUser(uid); updateUser(uid, { weapons: [...(u.weapons||[]), "Mythic Goldfish"] }); return "✨ **THE MYTHIC GOLDFISH!** A legendary weapon added to your arsenal!"; } },
  { name: "Junk",           emoji: "🗑️", weight: 12, action: (uid) => { addVbucks(uid, -50); return "Junk! You lost 50 V-Bucks pulling it out"; } },
  { name: "Supply Chest",   emoji: "📦", weight: 5,  action: (uid) => { const u = getUser(uid); updateUser(uid, { boxes: (u.boxes||0)+1 }); return "A **Supply Chest** underwater! +1 STW Box"; } },
];
function weightedFish() {
  const total = FISH_TABLE.reduce((a,b) => a+b.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH_TABLE) { r -= f.weight; if (r <= 0) return f; }
  return FISH_TABLE[0];
}

// Battle Bus drop locations
const DROP_LOCATIONS = [
  { name: "Tilted Towers",    emoji: "🏙️", bonus: "hotspot",  desc: "Hot drop! Contested. High risk, high reward." },
  { name: "Pleasant Park",    emoji: "🏘️", bonus: "xp",       desc: "Chill suburban vibes. Good XP gains."          },
  { name: "Lazy Lake",        emoji: "🏞️", bonus: "vbucks",   desc: "A quiet lake town hiding V-Bucks."             },
  { name: "Slurpy Swamp",     emoji: "🌿", bonus: "heal",     desc: "Healing waters flow here."                     },
  { name: "Steamy Stacks",    emoji: "🏭", bonus: "weapon",   desc: "Industrial zone. Weapons everywhere."          },
  { name: "Holly Hatchery",   emoji: "🌲", bonus: "sneak",    desc: "Dense cover. Sneaky plays."                    },
  { name: "Coral Castle",     emoji: "🐚", bonus: "special",  desc: "Mysterious underwater ruins."                  },
  { name: "Dirty Docks",      emoji: "⚓", bonus: "vbucks",   desc: "Shipping containers full of loot."             },
  { name: "Sweaty Sands",     emoji: "🏖️", bonus: "llama",    desc: "Llamas spotted on the beach!"                 },
];

// Named POIs for flavor
const FORTNITE_POIS = ["Tilted Towers","Pleasant Park","Lazy Lake","Slurpy Swamp","Retail Row","Misty Meadows","Steamy Stacks","Coral Castle","Holly Hatchery","Dirty Docks","Sweaty Sands","Craggy Cliffs","Catty Corner","Stark Industries","Authority"];

// Build materials
const BUILD_MATS = {
  wood:  { label: "🪵 Wood",  cost: 50,  charges: 1, desc: "Basic protection. Blocks 1 hit." },
  brick: { label: "🧱 Brick", cost: 125, charges: 2, desc: "Sturdy. Blocks 2 hits."          },
  metal: { label: "⚙️ Metal", cost: 250, charges: 3, desc: "Maximum defense. Blocks 3 hits." },
};

// Storm events
const STORM_EVENTS = [
  { name: "Safe Zone 🟢",     chance: 35, color: 0x00ff00, fn: (uid) => { addXP(uid, 100); return "You're in the **safe zone**! +100 XP"; } },
  { name: "Storm Edge ⚠️",   chance: 25, color: 0xffaa00, fn: (uid) => { addVbucks(uid, -100); return "You're on the **storm edge**! -100 V-Bucks taken by storm damage"; } },
  { name: "Eye of Storm ⭐",  chance: 15, color: 0xf4a01a, fn: (uid) => { addVbucks(uid, 500); addXP(uid, 200); return "You found the **Eye of the Storm**! +500 V-Bucks + 200 XP!"; } },
  { name: "In the Storm ☠️", chance: 20, color: 0xff0000, fn: (uid) => { addVbucks(uid, -250); return "You're deep **inside the storm**! -250 V-Bucks from storm damage"; } },
  { name: "Storm Surge ⚡",   chance: 5,  color: 0x9b4dca, fn: (uid) => { updateUser(uid, { eliminatedUntil: Date.now() + 3 * 60 * 1000 }); return "**Storm surge!** You were knocked down! Eliminated for 3 minutes"; } },
];
function rollStorm() {
  const total = STORM_EVENTS.reduce((a,b) => a+b.chance, 0);
  let r = Math.random() * total;
  for (const e of STORM_EVENTS) { r -= e.chance; if (r <= 0) return e; }
  return STORM_EVENTS[0];
}

// Battle Pass tiers
function getBattlePassTier(level, xp) {
  return Math.min(100, Math.floor(level * 2 + xp / 300));
}
const BP_REWARDS = [
  { tier: 5,   reward: "🎒 Spray: No Sweat"       },
  { tier: 10,  reward: "💃 Emote: Floss"           },
  { tier: 15,  reward: "🎒 Back Bling: Shield Can" },
  { tier: 20,  reward: "🔫 Wrap: Tiger"            },
  { tier: 30,  reward: "🎮 Loading Screen"         },
  { tier: 40,  reward: "👟 Contrail: Hearts"       },
  { tier: 50,  reward: "🌟 Outfit: Midas"          },
  { tier: 60,  reward: "🎭 Emote: On The Hook"     },
  { tier: 75,  reward: "💎 Glider: Midas' Drum"   },
  { tier: 100, reward: "👑 Full Gold Midas Skin!"  },
];

// Creator codes
const VALID_CODES = {
  tylajadee: { displayName: "Tylajadee", discount: 0.1, freeSkin: true },
  qckdream:  { displayName: "Qckdream",  discount: 0.1 },
  clovel:    { displayName: "Clovel",    discount: 0.2 },
};

// ─────────────────────────────────────────────
//  In-memory storage
// ─────────────────────────────────────────────
const DAILY_QUESTS = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",            xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                  xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",             xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",       xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];
function freshQuests() { return DAILY_QUESTS.map((q) => ({ ...q, current: 0, completed: false })); }

const FOUNDERS_QUEST_POOL = [
  { id: "catch_skins_3",  label: "Catch 3 skins from the spawn channel",   stat: "spawnCatches",    required: 3    },
  { id: "catch_skins_5",  label: "Catch 5 skins from the spawn channel",   stat: "spawnCatches",    required: 5    },
  { id: "win_flip_1",     label: "Win 1 coin flip",                         stat: "coinflipsWon",    required: 1    },
  { id: "win_flip_3",     label: "Win 3 coin flips",                        stat: "coinflipsWon",    required: 3    },
  { id: "buy_shop_1",     label: "Buy a skin from the Item Shop",           stat: "shopPurchases",   required: 1    },
  { id: "buy_shop_2",     label: "Buy 2 skins from the Item Shop",          stat: "shopPurchases",   required: 2    },
  { id: "open_stw",       label: "Open 1 Save the World Box",               stat: "boxesOpened",     required: 1    },
  { id: "daily_claim",    label: "Claim your daily reward",                 stat: "dailyStreak",     required: 1    },
  { id: "use_zeropoint",  label: "Use the /zeropoint command",              stat: "zeropointUses",   required: 1    },
  { id: "trade_skin",     label: "Complete a skin trade with someone",      stat: "tradesCompleted", required: 1    },
  { id: "gift_skin",      label: "Gift a skin to another player",           stat: "giftsGiven",      required: 1    },
  { id: "play_flip",      label: "Challenge someone to a coin flip",        stat: "coinflipsPlayed", required: 1    },
  { id: "earn_xp_300",    label: "Earn 300 XP on the bot",                  stat: "xp",              required: 300  },
  { id: "earn_xp_1000",   label: "Earn 1,000 XP on the bot",               stat: "xp",              required: 1000 },
  { id: "check_vbucks_5", label: "Check your V-Bucks 5 times",              stat: "vbucksChecked",   required: 5    },
  { id: "catch_10",       label: "Catch 10 items from the spawn channel",   stat: "spawnCatches",    required: 10   },
  { id: "level_3",        label: "Reach Level 3 on the bot",                stat: "level",           required: 3    },
  { id: "level_5",        label: "Reach Level 5 on the bot",                stat: "level",           required: 5    },
  { id: "open_llama",     label: "Open a Supply Llama",                     stat: "llamaOpens",      required: 1    },
  { id: "go_fishing",     label: "Catch something while fishing",           stat: "fishCaught",      required: 1    },
  { id: "survive_storm",  label: "Survive the storm 3 times",               stat: "stormsSurvived",  required: 3    },
  { id: "supply_drop_1",  label: "Call in a supply drop",                   stat: "supplyDrops",     required: 1    },
  { id: "duel_someone",   label: "Challenge someone to a duel",             stat: "duelsPlayed",     required: 1    },
  { id: "build_up",       label: "Build a structure for protection",        stat: "timesBuilt",      required: 1    },
];

function pickRandom(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }

function assignFoundersQuests(userId) {
  const user = getUser(userId);
  const pool = pickRandom(FOUNDERS_QUEST_POOL, 3);
  const quests = pool.map((q) => ({ ...q, baseline: user[q.stat] ?? 0, awardedBox: false }));
  updateUser(userId, { foundersQuestPending: quests });
  return quests;
}

function checkFoundersQuests(userId) {
  const user = getUser(userId);
  if (!user.foundersQuestPending?.length) return { newBoxes: 0, quests: [] };
  let newBoxes = 0;
  const updated = user.foundersQuestPending.map((q) => {
    if (q.awardedBox) return q;
    const current = (user[q.stat] ?? 0) - (q.baseline ?? 0);
    const done = current >= q.required;
    if (done) newBoxes++;
    return { ...q, awardedBox: done };
  });
  if (newBoxes > 0) updateUser(userId, { foundersQuestPending: updated, foundersBoxes: (user.foundersBoxes ?? 0) + newBoxes });
  else updateUser(userId, { foundersQuestPending: updated });
  return { newBoxes, quests: updated };
}

const _data = { config: { guildSpawnChannels: {} }, users: {}, itemShop: { skins: [], lastReset: 0 }, coinflipChallenges: {} };

function getUser(userId) {
  if (!_data.users[userId]) _data.users[userId] = {
    vbucks: 500, inventory: [], inventoryNames: {}, xp: 0, level: 1,
    interactionCount: 0, boxes: 0, quests: freshQuests(), lastQuestReset: Date.now(),
    lastDailyClaim: 0, dailyStreak: 0, achievementsEarned: [],
    coinflipsWon: 0, coinflipsPlayed: 0, boxesOpened: 0, giftsGiven: 0,
    tradesCompleted: 0, shopPurchases: 0, shopSkins: [], shopSkinPrices: {},
    brokeAttempt: false, refundCooldowns: {}, hasCreatorCode: false, creatorDiscount: 0,
    hasFoundersPack: false, foundersBoxes: 0, foundersBoxesOpened: 0,
    freeSkinExpiry: 0, freeSkinRedeemed: false, freeSkinIds: [],
    eliminatedUntil: 0, weapons: [],
    spawnCatches: 0, zeropointUses: 0, vbucksChecked: 0,
    luckPotion: 0, xtraLuckPotion: 0, godlyLuckPotion: 0,
    activeLuck: "none", infiniteVbucks: false,
    godChest: 0, mysteriousChest: 0,
    foundersQuestPending: [],
    llamaOpens: 0, fishCaught: 0, stormsSurvived: 0, supplyDrops: 0,
    duelsPlayed: 0, timesBuilt: 0,
    lastLlama: 0, lastSupplyDrop: 0, lastFish: 0, lastStorm: 0,
    buildCharges: 0, buildMaterial: "none",
  };
  const u = _data.users[userId];
  const defaults = {
    achievementsEarned: [], shopSkins: [], shopSkinPrices: {}, refundCooldowns: {},
    weapons: [], foundersQuestPending: [], freeSkinIds: [],
    luckPotion: 0, xtraLuckPotion: 0, godlyLuckPotion: 0, activeLuck: "none",
    infiniteVbucks: false, godChest: 0, mysteriousChest: 0,
    spawnCatches: 0, zeropointUses: 0, vbucksChecked: 0, coinflipsPlayed: 0,
    llamaOpens: 0, fishCaught: 0, stormsSurvived: 0, supplyDrops: 0,
    duelsPlayed: 0, timesBuilt: 0,
    lastLlama: 0, lastSupplyDrop: 0, lastFish: 0, lastStorm: 0,
    buildCharges: 0, buildMaterial: "none",
  };
  for (const [k, v] of Object.entries(defaults)) { if (u[k] === undefined) u[k] = v; }
  return u;
}

function updateUser(userId, update) {
  const user = getUser(userId);
  Object.assign(user, update);
  _data.users[userId] = user;
}

function addInteraction(userId) {
  const user = getUser(userId);
  user.interactionCount += 1;
  const gained = user.interactionCount % 30 === 0;
  if (gained && !user.infiniteVbucks) user.vbucks += 250;
  return { gainedVbucks: gained };
}

function addVbucks(userId, amount) {
  const u = getUser(userId);
  if (u.infiniteVbucks && amount < 0) return;
  u.vbucks += amount;
}

function addSkinToInventory(userId, skinId, skinName) {
  const u = getUser(userId);
  u.inventory.push(skinId);
  u.inventoryNames[skinId + "_" + u.inventory.length] = skinName;
}

function xpForLevel(level) { return Math.min(100 * level, 450); }
function calculateLevelFromXP(totalXp) {
  let level = 1, remaining = totalXp;
  while (true) {
    const needed = xpForLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpForNext: needed };
    remaining -= needed; level++;
  }
}
function addXP(userId, amount) {
  const u = getUser(userId);
  const before = calculateLevelFromXP(u.xp);
  u.xp += amount;
  const after = calculateLevelFromXP(u.xp);
  const leveledUp = after.level > before.level;
  u.level = after.level;
  if (leveledUp) u.boxes += after.level - before.level;
  return { leveledUp, newLevel: after.level };
}

function resetQuestsIfNeeded(userId) {
  const u = getUser(userId);
  if (Date.now() - u.lastQuestReset > 24 * 60 * 60 * 1000) {
    u.quests = freshQuests(); u.lastQuestReset = Date.now();
  }
}

function progressQuest(userId, questId, amount = 1) {
  resetQuestsIfNeeded(userId);
  const u = getUser(userId);
  const quest = u.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;
  quest.current = Math.min(quest.current + amount, quest.required);
  if (quest.current >= quest.required) {
    quest.completed = true;
    addXP(userId, quest.xpReward);
    u.foundersBoxes = (u.foundersBoxes ?? 0) + 1;
  }
  return quest.completed ? quest : null;
}

function isEliminated(userId) { return (getUser(userId).eliminatedUntil ?? 0) > Date.now(); }
function getEliminationTimeLeft(userId) { return Math.max(0, (getUser(userId).eliminatedUntil ?? 0) - Date.now()); }
function hasActiveFreeSkin(userId) { const u = getUser(userId); return (u.freeSkinExpiry ?? 0) > Date.now() && !(u.freeSkinRedeemed ?? false); }
function getItemShop() { return _data.itemShop; }
function setItemShop(skins) { _data.itemShop = { skins, lastReset: Date.now() }; }
function getSpawnChannel(guildId) { return _data.config.guildSpawnChannels[guildId]; }
function setSpawnChannel(guildId, channelId) { _data.config.guildSpawnChannels[guildId] = channelId; }
function getAllGuildSpawnChannels() { return _data.config.guildSpawnChannels; }
function getAllUsers() { return _data.users; }
function setCoinflipChallenge(id, ch) { _data.coinflipChallenges[id] = ch; }
function getCoinflipChallenge(id) { return _data.coinflipChallenges[id]; }
function deleteCoinflipChallenge(id) { delete _data.coinflipChallenges[id]; }

// ─────────────────────────────────────────────
//  Luck helpers
// ─────────────────────────────────────────────
const LUCK_BOOST = { none: 0, normal: 15, xtra: 40, godly: 80 };
function boostedChance(base, luck) { return Math.min(base + (LUCK_BOOST[luck] || 0), 99); }
function roll(pct) { return Math.random() * 100 < pct; }

// ─────────────────────────────────────────────
//  Achievements
// ─────────────────────────────────────────────
const ALL_ACHIEVEMENTS = [
  { id: "first_catch",      title: "First Catch",                  emoji: "🎮", description: "Catch your first spawned skin",                   check: (u) => u.inventory.length >= 1 },
  { id: "collector",        title: "Collector",                    emoji: "🎒", description: "Own 10 skins",                                    check: (u) => u.inventory.length >= 10 },
  { id: "hoarder",          title: "Hoarder",                      emoji: "📦", description: "Own 50 skins",                                    check: (u) => u.inventory.length >= 50 },
  { id: "shop_regular",     title: "Shop Regular",                 emoji: "🛒", description: "Buy a skin from the Item Shop",                   check: (u) => (u.shopPurchases ?? 0) >= 1 },
  { id: "big_spender",      title: "Big Spender",                  emoji: "💸", description: "Buy 5 skins from the Item Shop",                  check: (u) => (u.shopPurchases ?? 0) >= 5 },
  { id: "generous",         title: "Generous",                     emoji: "🎁", description: "Gift a skin to another player",                   check: (u) => (u.giftsGiven ?? 0) >= 1 },
  { id: "trader",           title: "Trader",                       emoji: "🔄", description: "Complete a skin trade",                           check: (u) => (u.tradesCompleted ?? 0) >= 1 },
  { id: "lucky_flip",       title: "Lucky Flip",                   emoji: "🪙", description: "Win a coin flip",                                 check: (u) => (u.coinflipsWon ?? 0) >= 1 },
  { id: "flip_master",      title: "Flip Master",                  emoji: "🎰", description: "Win 10 coin flips",                               check: (u) => (u.coinflipsWon ?? 0) >= 10 },
  { id: "box_opener",       title: "Box Opener",                   emoji: "📬", description: "Open a Save the World Box",                       check: (u) => (u.boxesOpened ?? 0) >= 1 },
  { id: "stw_devotee",      title: "STW Devotee",                  emoji: "⚡", description: "Open 10 Save the World Boxes",                    check: (u) => (u.boxesOpened ?? 0) >= 10 },
  { id: "streak_starter",   title: "Streak Starter",               emoji: "🔥", description: "3-day daily streak",                              check: (u) => (u.dailyStreak ?? 0) >= 3 },
  { id: "on_fire",          title: "On Fire",                      emoji: "🌋", description: "7-day daily streak",                              check: (u) => (u.dailyStreak ?? 0) >= 7 },
  { id: "unstoppable",      title: "Unstoppable",                  emoji: "👑", description: "30-day daily streak",                             check: (u) => (u.dailyStreak ?? 0) >= 30 },
  { id: "level_5",          title: "Rising Star",                  emoji: "⭐", description: "Reach Level 5",                                  check: (u) => u.level >= 5 },
  { id: "level_10",         title: "Veteran",                      emoji: "🌟", description: "Reach Level 10",                                  check: (u) => u.level >= 10 },
  { id: "level_25",         title: "Legend",                       emoji: "💫", description: "Reach Level 25",                                  check: (u) => u.level >= 25 },
  { id: "wealthy",          title: "Wealthy",                      emoji: "💰", description: "Hold 5,000 V-Bucks at once",                      check: (u) => u.vbucks >= 5000 },
  { id: "rich",             title: "Rich",                         emoji: "💎", description: "Hold 10,000 V-Bucks at once",                     check: (u) => u.vbucks >= 10000 },
  { id: "broke",            title: "Broke",                        emoji: "🪙", description: "Tried to buy something you can't afford",         check: (u) => u.brokeAttempt === true },
  { id: "scammed",          title: "Scammed",                      emoji: "🤡", description: "Fell for a free vbucks scam",                     check: () => false },
  { id: "epic_likes_you",   title: "Epic Games Likes You",         emoji: "💚", description: "Get a refund approved",                           check: () => false },
  { id: "epic_hates_you",   title: "Epic Games Doesn't Like You", emoji: "💔", description: "Get a refund rejected",                           check: () => false },
  { id: "llama_opener",     title: "Llama Opener",                 emoji: "🦙", description: "Open your first Supply Llama",                    check: (u) => (u.llamaOpens ?? 0) >= 1 },
  { id: "llama_hoarder",    title: "Llama Hoarder",                emoji: "🦙", description: "Open 5 Supply Llamas",                            check: (u) => (u.llamaOpens ?? 0) >= 5 },
  { id: "angler",           title: "Angler",                       emoji: "🎣", description: "Catch your first fish",                           check: (u) => (u.fishCaught ?? 0) >= 1 },
  { id: "master_angler",    title: "Master Angler",                emoji: "🐟", description: "Catch 10 fish",                                   check: (u) => (u.fishCaught ?? 0) >= 10 },
  { id: "goldfish",         title: "It's a Goldfish",              emoji: "✨", description: "Fish up the Mythic Goldfish",                     check: () => false },
  { id: "storm_survivor",   title: "Storm Survivor",               emoji: "🌪️", description: "Survive the storm 5 times",                       check: (u) => (u.stormsSurvived ?? 0) >= 5 },
  { id: "builder",          title: "Builder",                      emoji: "🏗️", description: "Build your first structure",                       check: (u) => (u.timesBuilt ?? 0) >= 1 },
  { id: "master_builder",   title: "Master Builder",               emoji: "🏰", description: "Build 10 structures",                             check: (u) => (u.timesBuilt ?? 0) >= 10 },
  { id: "duel_champion",    title: "Duel Champion",                emoji: "⚔️", description: "Win a duel",                                      check: () => false },
  { id: "battle_pass_100",  title: "Battle Pass Complete",         emoji: "👑", description: "Reach Battle Pass Tier 100",                      check: (u) => getBattlePassTier(u.level, u.xp) >= 100 },
];

function checkAndAwardAchievements(userId) {
  const user = getUser(userId);
  const newlyEarned = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!user.achievementsEarned.includes(ach.id) && ach.check(user)) {
      user.achievementsEarned.push(ach.id);
      newlyEarned.push(ach.title);
    }
  }
  return newlyEarned;
}
function awardAchievement(userId, achId) {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
  if (!ach) return null;
  const user = getUser(userId);
  if (user.achievementsEarned.includes(achId)) return null;
  user.achievementsEarned.push(achId);
  return ach;
}
function buildAchievementEmbed(ach) {
  return new EmbedBuilder().setTitle(`${ach.emoji} Achievement Unlocked!`).setDescription(`**${ach.title}**\n*${ach.description}*`).setColor(0xf4a01a).setTimestamp();
}

// ─────────────────────────────────────────────
//  Skin API
// ─────────────────────────────────────────────
const STW_KEYWORDS = ["robo","kevin","save the world","constructor","ninja","outlander","soldier","commando","striker","ramirez","headhunter","jonesy","penny","dim mak","brawler","dragon","powerhouse","hazard","renegade","urban assault","special forces"];
const KNOWN_STW_IDS = ["CID_028_Athena_Commando_F","CID_029_Athena_Commando_F_Halloween","CID_017_Athena_Commando_M","CID_040_Athena_Commando_M_NinjaBlue"];
let cachedSkins = [], cachedStwSkins = [];

async function fetchFortniteSkins() {
  if (cachedSkins.length > 0) return cachedSkins;
  try {
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br", { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    cachedSkins = json.data.filter((s) => {
      if (s.type?.value !== "outfit") return false;
      const name = s.name?.trim();
      if (!name || name === "null" || name === "TBD" || name.toLowerCase().startsWith("tid_")) return false;
      const img = s.images?.featured || s.images?.icon || s.images?.small;
      return img && img.trim() !== "" && img !== "null";
    }).map((s) => {
      const nameLower = s.name.toLowerCase(), descLower = (s.description ?? "").toLowerCase();
      const tags = (s.gameplayTags ?? []).join(" ").toLowerCase();
      const isStw = KNOWN_STW_IDS.includes(s.id) || STW_KEYWORDS.some((k) => nameLower.includes(k) || descLower.includes(k) || tags.includes(k));
      return { id: s.id, name: s.name, description: s.description && s.description !== "null" ? s.description : "A Fortnite outfit.", rarity: s.rarity?.displayValue || "Common", imageUrl: s.images?.featured || s.images?.icon || s.images?.small || "", isStw };
    });
    cachedStwSkins = cachedSkins.filter((s) => s.isStw);
  } catch (err) {
    console.error("Failed to fetch skins:", err.message);
    cachedSkins = [{ id: "default", name: "Default", description: "A basic outfit.", rarity: "Common", imageUrl: "", isStw: false }];
    cachedStwSkins = [];
  }
  return cachedSkins;
}

function weightedRandom(skins) {
  const weights = skins.map((s) => RARITY_WEIGHTS[s.rarity.toLowerCase()] ?? 15);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < skins.length; i++) { rand -= weights[i]; if (rand <= 0) return skins[i]; }
  return skins[skins.length - 1];
}
async function getRandomSkin() { const s = await fetchFortniteSkins(); return weightedRandom(s); }
async function getStwSkins() { if (cachedStwSkins.length > 0) return cachedStwSkins; await fetchFortniteSkins(); return cachedStwSkins; }
async function getRandomStwSkin() { const s = await getStwSkins(); return s.length ? s[Math.floor(Math.random() * s.length)] : null; }
async function getRandomShopSkins(n = 5) { const s = await fetchFortniteSkins(); return [...s].sort(() => Math.random() - 0.5).slice(0, n); }
async function findSkinByName(query) {
  const skins = await fetchFortniteSkins(), q = query.trim().toLowerCase();
  const exact = skins.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = skins.filter((s) => s.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return partial.find((s) => s.name.toLowerCase().startsWith(q)) ?? partial[0];
  return null;
}

function getRarityColor(rarity) {
  const c = { legendary: 0xf4a01a, epic: 0x9b4dca, rare: 0x0075e3, uncommon: 0x1a9b1a, common: 0x808080, marvel: 0xed1d24, icon: 0x00d4ff, shadow: 0x2c2c2c, slurp: 0x00e5ff, frozen: 0xa8d8ea, lava: 0xff4500, dark: 0x6a0dad };
  return c[rarity.toLowerCase()] ?? 0x808080;
}
function getRarityEmoji(rarity) {
  const e = { legendary: "🟡", epic: "🟣", rare: "🔵", uncommon: "🟢", common: "⚪", marvel: "🔴", icon: "🩵" };
  return e[rarity.toLowerCase()] ?? "⚪";
}
function getSpawnPercent(rarity) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  return (((RARITY_WEIGHTS[rarity.toLowerCase()] ?? 15) / total) * 100).toFixed(1);
}

// ─────────────────────────────────────────────
//  Shop
// ─────────────────────────────────────────────
async function ensureShopFresh() {
  const shop = getItemShop();
  if (shop.skins.length > 0 && Date.now() - shop.lastReset < SHOP_RESET_MS) return shop.skins;
  const skins = await getRandomShopSkins(5);
  const shopSkins = skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: SKIN_PRICE }));
  setItemShop(shopSkins);
  return shopSkins;
}
function getTimeUntilReset() {
  const msLeft = Math.max(0, SHOP_RESET_MS - (Date.now() - getItemShop().lastReset));
  return `${Math.floor(msLeft / 3600000)}h ${Math.floor((msLeft % 3600000) / 60000)}m`;
}

// ─────────────────────────────────────────────
//  Chest openers (internal helpers)
// ─────────────────────────────────────────────
async function openGodChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.godChest <= 0) return interaction.reply({ content: "❌ You have no God Chests!", ephemeral: true });
  player.godChest--;
  const luck = player.activeLuck;
  const mystChance = boostedChance(25, luck), vbChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < mystChance) {
    player.mysteriousChest++;
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_myst_inline`).setLabel("🔵 Open Mysterious Chest Now").setStyle(ButtonStyle.Primary));
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("🔵 A Mysterious Chest appeared!").setDescription("A **BLUE MYSTERIOUS CHEST** emerged from the God Chest!\n\nOpen it to reveal its contents!").setFooter({ text: "Click to open!" });
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const col = reply.createMessageComponentCollector({ time: 60000 });
    col.on("collect", async (btn) => {
      if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
      await openMysteriousChestInteraction(btn, userId); col.stop();
    });
  } else if (rng < mystChance + vbChance) {
    addVbucks(userId, 1000);
    const updated = getUser(userId);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🌟 God Chest — 1,000 V-Bucks!").setDescription(`You received **1,000 V-Bucks** from the God Chest!\nTotal: **${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌟 God Chest — Empty").setDescription("The God Chest glimmered... but was hollow inside.\n\nBetter luck next time!").setFooter({ text: `Myst: ${mystChance}% | 1k V-Bucks: ${vbChance}% | Nothing: rest` })] });
  }
}

async function openMysteriousChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.mysteriousChest <= 0) return interaction.reply({ content: "❌ You have no Mysterious Chests!", ephemeral: true });
  player.mysteriousChest--;
  const luck = player.activeLuck;
  const infChance = boostedChance(15, luck), tenKChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < infChance) {
    player.infiniteVbucks = true;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — INFINITE V-BUCKS!").setDescription("✨ **INFINITE V-BUCKS!** ✨\nYour V-Bucks will **never go down** again!")] });
  } else if (rng < infChance + tenKChance) {
    addVbucks(userId, 10000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 10,000 V-Bucks!").setDescription(`You received **10,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    addVbucks(userId, 1000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 1,000 V-Bucks").setDescription(`You received **1,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  }
}

// ─────────────────────────────────────────────
//  Founders Box roll
// ─────────────────────────────────────────────
const FOUNDERS_BOX_TIERS = [
  { amount: 100, weight: 40 }, { amount: 200, weight: 30 },
  { amount: 350, weight: 20 }, { amount: 550, weight: 10 },
];
function rollFoundersBoxVbucks() {
  const total = FOUNDERS_BOX_TIERS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const t of FOUNDERS_BOX_TIERS) { r -= t.weight; if (r <= 0) return t.amount; }
  return 100;
}

// ─────────────────────────────────────────────
//  Spawn system
// ─────────────────────────────────────────────
const activeSpawns = {};
const spawnTimers = {};
let botClient = null;
const MIN_SPAWN_MS = 3 * 60 * 1000, MAX_SPAWN_MS = 5 * 60 * 1000;
function getNextSpawnDelay() { return MIN_SPAWN_MS + Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS); }
function getActiveSpawn(guildId) { return activeSpawns[guildId] ?? null; }
function scheduleNextSpawn(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  if (activeSpawns[guildId]) return;
  spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
}
async function spawnRandom(client, guildId, channelId) {
  const r = Math.random();
  if (r < 1/35) await spawnStwPacks(client, guildId, channelId);
  else if (r < 2/35) await spawnLuckPotion(client, guildId, channelId);
  else await spawnSkin(client, guildId, channelId);
}
async function spawnSkin(client, guildId, channelId, forced = false, specificSkin) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const skin = specificSkin ?? await getRandomSkin();
    const embed = new EmbedBuilder().setTitle(`${getRarityEmoji(skin.rarity)} **${skin.name}** has spawned!`).setDescription(`*${skin.description}*\n\n✨ **Rarity:** ${skin.rarity}\n\nType \`buy\` to claim!`).setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setFooter({ text: "Fortnite Skin Catcher • First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "skin", skin, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnVbucks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("💰 V-Bucks Drop!").setDescription("A bag of **1,000 V-Bucks** has appeared!\n\nType `buy` to grab them!").setColor(0x00d4ff).setImage(VBUCKS_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "vbucks", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnStwPacks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("⚡ Save the World Pack Drop!").setDescription("**5 Save the World Packs** have appeared!\n\nType `buy` to claim all 5 boxes!").setColor(0xff6600).setImage(STW_LOGO_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "stw_packs", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersPack(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("🌟 Founders Pack Has Spawned!").setDescription("A rare **Founders Pack** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_PACK_IMAGE).setFooter({ text: "Very rare!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_pack", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersBox(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Has Spawned!").setDescription("A **Founders Box** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_BOX_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_box", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnLuckPotion(client, guildId, channelId, forced = false, type = "luckPotion") {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion" };
  const label = labels[type] || labels.luckPotion;
  const realType = labels[type] ? type : "luckPotion";
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle(`${label} Spawned!`).setDescription(`A **${label}** has appeared!\n\nType \`buy\` to claim!`).setColor(0x2ecc71).setImage(LUCK_POT_IMG).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: realType, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function handleBuyMessage(message) {
  const guildId = message.guildId;
  if (!guildId) return;
  const channelId = getSpawnChannel(guildId);
  if (!channelId || message.channelId !== channelId) return;
  const spawn = activeSpawns[guildId];
  if (!spawn || spawn.claimedBy) return;
  const userId = message.author.id;
  if (isEliminated(userId)) {
    const m = Math.ceil(getEliminationTimeLeft(userId) / 60000);
    await message.channel.send({ content: `<@${userId}> ☠️ Eliminated! Can't catch anything for **${m} min**. Ask someone to \`/reboot\` you!` });
    return;
  }
  if (spawn.type === "founders_pack") {
    const user = getUser(userId);
    if (user.hasFoundersPack) { await message.channel.send({ content: `<@${userId}> ❌ You already own a Founders Pack!` }); return; }
  }
  spawn.claimedBy = userId;
  delete activeSpawns[guildId];
  const { gainedVbucks } = addInteraction(userId);
  addXP(userId, 50);
  updateUser(userId, { spawnCatches: (getUser(userId).spawnCatches ?? 0) + 1 });
  let embed;
  if (spawn.type === "vbucks") {
    addVbucks(userId, 1000);
    let desc = `<@${userId}> grabbed **1,000 V-Bucks**! 💰\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`💰 ${message.author.username} grabbed the V-Bucks!`).setDescription(desc).setColor(0x00d4ff).setTimestamp();
  } else if (spawn.type === "stw_packs") {
    updateUser(userId, { boxes: getUser(userId).boxes + 5 });
    let desc = `<@${userId}> claimed **5 STW Packs**! Open them with \`/savetheworld\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed STW Packs!`).setDescription(desc).setColor(0xff6600).setTimestamp();
  } else if (spawn.type === "founders_pack") {
    updateUser(userId, { hasFoundersPack: true });
    let desc = `<@${userId}> claimed the **Founders Pack**! 🌟\n\nUse \`/founderspack\` to open boxes and complete bot quests!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🌟 ${message.author.username} claimed the Founders Pack!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "founders_box") {
    const u3 = getUser(userId);
    updateUser(userId, { foundersBoxes: (u3.foundersBoxes ?? 0) + 1 });
    const msg2 = u3.hasFoundersPack ? "Open it with `/founderspack`!" : "Get a Founders Pack to open it!";
    let desc = `<@${userId}> claimed a **Founders Box**! 📦\n\n${msg2}\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed a Founders Box!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "luckPotion" || spawn.type === "xtraLuckPotion") {
    const u4 = getUser(userId);
    updateUser(userId, { [spawn.type]: (u4[spawn.type] ?? 0) + 1 });
    const label = spawn.type === "luckPotion" ? "🍀 Luck Potion" : "🔮 Xtra Luck Potion";
    let desc = `<@${userId}> grabbed a **${label}**! Use it with \`/useluckpotion\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`✨ ${message.author.username} claimed a ${label}!`).setDescription(desc).setColor(0x2ecc71).setTimestamp();
  } else if (spawn.type === "skin" && spawn.skin) {
    addSkinToInventory(userId, spawn.skin.id, spawn.skin.name);
    progressQuest(userId, "catch_skins");
    const na = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> snagged **${spawn.skin.name}**!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🏆 ${message.author.username} caught ${spawn.skin.name}!`).setDescription(desc).setColor(getRarityColor(spawn.skin.rarity)).setThumbnail(spawn.skin.imageUrl).setTimestamp();
  } else return;
  await message.channel.send({ embeds: [embed] });
  if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
}

function initSpawner(client) {
  botClient = client;
  for (const [guildId, channelId] of Object.entries(getAllGuildSpawnChannels())) {
    if (!channelId) continue;
    spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
  }
}
function restartSpawner(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  delete activeSpawns[guildId];
  scheduleNextSpawn(client, guildId, channelId);
}

// ─────────────────────────────────────────────
//  Slash Commands
// ─────────────────────────────────────────────
const commands = [

  // ── /setup ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("setup").setDescription("Set the channel where Fortnite skins will spawn").addChannelOption((o) => o.setName("channel").setDescription("Text channel for spawns").addChannelTypes(ChannelType.GuildText).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel", true);
      setSpawnChannel(guildId, channel.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Bot Setup Complete!").setDescription(`Skins will spawn in <#${channel.id}>!\n\nFirst skin appears shortly, then every **3–5 minutes**.\n\nType \`buy\` to catch spawns!`).setColor(0x00d4ff).setTimestamp()] });
      if (interaction.client) restartSpawner(interaction.client, guildId, channel.id);
    },
  },

  // ── /forcespawn ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("forcespawn").setDescription("Force a spawn in the spawn channel").addStringOption((o) => o.setName("item").setDescription("What to spawn").setRequired(false).addChoices({ name: "Random Skin", value: "skin" }, { name: "V-Bucks Drop", value: "vbucks" }, { name: "STW Packs", value: "stw" }, { name: "Founders Pack", value: "founders_pack" }, { name: "Founders Box", value: "founders_box" }, { name: "Luck Potion", value: "luckPotion" }, { name: "Xtra Luck Potion", value: "xtraLuckPotion" })).addStringOption((o) => o.setName("skin_name").setDescription("Specific skin name").setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channelId = getSpawnChannel(guildId);
      if (!channelId) return interaction.reply({ content: "❌ No spawn channel! Use `/setup` first.", ephemeral: true });
      if (getActiveSpawn(guildId)) return interaction.reply({ content: `⚠️ Something is already spawned!`, ephemeral: true });
      const skinName = interaction.options.getString("skin_name");
      const item = interaction.options.getString("item") ?? "skin";
      if (skinName) {
        await interaction.deferReply({ ephemeral: true });
        const match = await findSkinByName(skinName);
        if (!match) { await interaction.editReply({ content: `❌ Couldn't find **"${skinName}"**.` }); return; }
        await interaction.editReply({ content: `🎮 Spawning **${match.name}** in <#${channelId}>...` });
        await spawnSkin(interaction.client, guildId, channelId, true, match); return;
      }
      const actions = { skin: () => spawnSkin(interaction.client, guildId, channelId, true), vbucks: () => spawnVbucks(interaction.client, guildId, channelId, true), stw: () => spawnStwPacks(interaction.client, guildId, channelId, true), founders_pack: () => spawnFoundersPack(interaction.client, guildId, channelId, true), founders_box: () => spawnFoundersBox(interaction.client, guildId, channelId, true), luckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "luckPotion"), xtraLuckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "xtraLuckPotion") };
      await interaction.reply({ content: `✅ Spawning in <#${channelId}>...`, ephemeral: true });
      await (actions[item] ?? actions.skin)();
    },
  },

  // ── /vbucks ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("vbucks").setDescription("Check your V-Bucks balance"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId);
      const { gainedVbucks } = addInteraction(userId);
      progressQuest(userId, "check_vbucks");
      const user = getUser(userId);
      user.vbucksChecked = (user.vbucksChecked ?? 0) + 1;
      const nextMilestone = 30 - (user.interactionCount % 30);
      const tier = getBattlePassTier(user.level, user.xp);
      const embed = new EmbedBuilder().setTitle("💰 V-Bucks Balance")
        .setDescription(`**${interaction.user.username}**, your wallet:\n\n💰 **${user.infiniteVbucks ? "INFINITE ∞" : user.vbucks.toLocaleString()} V-Bucks**\n\n📊 **Level:** ${user.level} · **XP:** ${user.xp}\n🎮 **Battle Pass Tier:** ${tier}/100\n🏗️ **Build:** ${user.buildCharges > 0 ? `${BUILD_MATS[user.buildMaterial]?.label ?? "🪵 Wood"} (${user.buildCharges} charge${user.buildCharges !== 1 ? "s" : ""})` : "None"}\n💬 **Interactions:** ${user.interactionCount}\n🎁 **Next bonus in:** ${nextMilestone} interactions`)
        .setColor(0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
        .setFooter({ text: gainedVbucks ? "🎉 You just earned 250 V-Bucks for a milestone!" : "Earn 250 V-Bucks every 30 interactions!" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /itemshop ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("itemshop").setDescription("Browse today's Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId); progressQuest(userId, "check_shop");
      const skins = await ensureShopFresh();
      let page = 0;
      const buildPage = (p) => {
        const skin = skins[p], user = getUser(userId);
        const discount = user.creatorDiscount ?? 0, finalPrice = Math.floor(skin.price * (1 - discount));
        const embed = new EmbedBuilder().setTitle(`🛒 Item Shop — Skin ${p + 1} of ${skins.length}`)
          .setDescription(`${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ Rarity: **${skin.rarity}**\n\n💰 **Price: ${finalPrice.toLocaleString()} V-Bucks**${user.hasCreatorCode ? ` 🏷️ *(${Math.round(discount * 100)}% off)*` : ""}\n\n🔄 Shop resets in **${getTimeUntilReset()}**`)
          .setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setFooter({ text: "Use /creatorcode for a discount!" }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shop_prev_${p}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`shop_buy_${p}`).setLabel(`Buy — ${finalPrice.toLocaleString()} V-Bucks`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`shop_next_${p}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= skins.length - 1)
        );
        return { embed, row, finalPrice };
      };
      const { embed, row } = buildPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId.startsWith("shop_prev")) { page = Math.max(0, page - 1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_next")) { page = Math.min(skins.length - 1, page + 1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_buy")) {
          const skin = skins[page], freshUser = getUser(userId);
          const fp = Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
          if (!freshUser.infiniteVbucks && freshUser.vbucks < fp) {
            if (!freshUser.brokeAttempt) { updateUser(userId, { brokeAttempt: true }); const ach = awardAchievement(userId, "broke"); await btn.reply({ content: `❌ Need **${fp.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: ach ? [buildAchievementEmbed(ach)] : [] }); }
            else await btn.reply({ content: `❌ Not enough V-Bucks!` });
            return;
          }
          if (freshUser.inventory.includes(skin.skinId)) { await btn.reply({ content: `⚠️ Already own **${skin.name}**!` }); return; }
          if (!freshUser.infiniteVbucks) addVbucks(userId, -fp);
          addSkinToInventory(userId, skin.skinId, skin.name);
          updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: fp } });
          checkAndAwardAchievements(userId);
          const updated = getUser(userId);
          await btn.reply({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n💰 Spent: ${fp.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp()] });
        }
      });
      collector.on("end", async () => { const { embed: e } = buildPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /buy ─────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("buy").setDescription("Purchase a skin from the current Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      if (isEliminated(userId)) { const m = Math.ceil(getEliminationTimeLeft(userId) / 60000); await interaction.editReply({ content: `☠️ Eliminated for **${m} min**. Ask someone to \`/reboot\` you.` }); return; }
      const skins = await ensureShopFresh(), user = getUser(userId);
      const isFree = hasActiveFreeSkin(userId), discount = isFree ? 1 : (user.creatorDiscount ?? 0);
      const options = skins.map((s, i) => { const fp = isFree ? 0 : Math.floor(s.price * (1 - discount)); return new StringSelectMenuOptionBuilder().setLabel(isFree ? `${s.name} — FREE 🎁` : `${s.name} — ${fp.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i)); });
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("buy_select").setPlaceholder("Choose a skin...").addOptions(options));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(isFree ? "🎁 Free Skin! Pick Yours" : "🛒 Buy a Skin").setDescription(isFree ? "Free skin from Tylajadee creator code!" : `Balance: **${user.vbucks.toLocaleString()} V-Bucks**\n\nSelect a skin:`).setColor(isFree ? 0xffd700 : 0x00d4ff).setTimestamp()], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const skin = skins[parseInt(sel.values[0])], freshUser = getUser(userId);
        const freshFree = hasActiveFreeSkin(userId), fp = freshFree ? 0 : Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
        if (!freshFree && !freshUser.infiniteVbucks && freshUser.vbucks < fp) { await sel.update({ content: `❌ Need **${fp.toLocaleString()} V-Bucks**.`, embeds: [], components: [] }); return; }
        if (freshUser.inventory.includes(skin.skinId)) { await sel.update({ content: `⚠️ Already own **${skin.name}**!`, embeds: [], components: [] }); return; }
        if (fp > 0 && !freshUser.infiniteVbucks) addVbucks(userId, -fp);
        addSkinToInventory(userId, skin.skinId, skin.name);
        updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: fp }, ...(freshFree ? { freeSkinRedeemed: true } : {}) });
        checkAndAwardAchievements(userId);
        const updated = getUser(userId);
        await sel.update({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n\n💰 **Spent:** ${fp.toLocaleString()} V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp()], components: [] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /gift ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("gift").setDescription("Gift a skin from the Item Shop to another player").addUserOption((o) => o.setName("player").setDescription("Player to gift to").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't gift yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't gift bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const skins = await ensureShopFresh(), user = getUser(userId);
      const options = skins.map((s, i) => new StringSelectMenuOptionBuilder().setLabel(`${s.name} — ${s.price.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i)));
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("gift_select").setPlaceholder("Choose a skin to gift...").addOptions(options));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎁 Gift a Skin to ${target.username}`).setDescription(`Your balance: **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks**\n\nSelect a skin:`).setColor(0xff69b4).setTimestamp()], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const skin = skins[parseInt(sel.values[0])], freshUser = getUser(userId);
        if (!freshUser.infiniteVbucks && freshUser.vbucks < skin.price) { await sel.update({ content: `❌ Need **${skin.price.toLocaleString()} V-Bucks**.`, embeds: [], components: [] }); return; }
        const targetUser = getUser(target.id);
        if (targetUser.inventory.includes(skin.skinId)) {
          const alreadyEmbed = new EmbedBuilder().setTitle("⚠️ They Already Own This Skin!").setDescription(`**${target.username}** already owns **${skin.name}**!\n\nSend them **1,500 V-Bucks** instead?`).setColor(0xffaa00).setTimestamp();
          const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("gift_vb_yes").setLabel("✅ Yes — Send 1,500 V-Bucks").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("gift_vb_no").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
          await sel.update({ embeds: [alreadyEmbed], components: [confirmRow] }); collector.stop();
          const btnMsg = await interaction.fetchReply();
          const btnCol = btnMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000, filter: (b) => b.user.id === userId });
          btnCol.on("collect", async (btn) => {
            if (btn.customId === "gift_vb_yes") {
              const latest = getUser(userId);
              if (!latest.infiniteVbucks && latest.vbucks < 1500) { await btn.update({ content: "❌ Not enough V-Bucks!", embeds: [], components: [] }); return; }
              if (!latest.infiniteVbucks) addVbucks(userId, -1500);
              addVbucks(target.id, 1500);
              const after = getUser(userId);
              await btn.update({ embeds: [new EmbedBuilder().setTitle("💸 V-Bucks Transferred!").setDescription(`Sent **1,500 V-Bucks** to <@${target.id}>!\n💳 Remaining: ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()], components: [] });
              if (interaction.channel?.send) await interaction.channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("💸 You received V-Bucks!").setDescription(`<@${userId}> sent you **1,500 V-Bucks**!`).setColor(0x00d4ff).setTimestamp()] });
            } else await btn.update({ content: "❌ Gift cancelled.", embeds: [], components: [] });
            btnCol.stop();
          });
          return;
        }
        if (!freshUser.infiniteVbucks) addVbucks(userId, -skin.price);
        addSkinToInventory(target.id, skin.skinId, skin.name);
        updateUser(userId, { giftsGiven: (freshUser.giftsGiven ?? 0) + 1 }); checkAndAwardAchievements(userId);
        const senderAfter = getUser(userId);
        await sel.update({ embeds: [new EmbedBuilder().setTitle("🎁 Gift Sent!").setDescription(`${getRarityEmoji(skin.rarity)} You gifted **${skin.name}** to <@${target.id}>!\n\n💰 Spent: ${skin.price.toLocaleString()} V-Bucks\n💳 Remaining: ${senderAfter.infiniteVbucks ? "∞" : senderAfter.vbucks.toLocaleString()} V-Bucks`).setColor(0xff69b4).setThumbnail(skin.imageUrl).setTimestamp()], components: [] });
        if (interaction.channel?.send) await interaction.channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🎁 You received a gift!").setDescription(`<@${userId}> sent you **${skin.name}**!\n\nCheck \`/inventory\`!`).setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setTimestamp()] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /coinflip ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("coinflip").setDescription("Challenge another player to a V-Bucks coin flip!").addUserOption((o) => o.setName("player").setDescription("Player to challenge").setRequired(true)).addIntegerOption((o) => o.setName("amount").setDescription("V-Bucks to bet (default: 100)").setMinValue(10).setMaxValue(10000)),
    async execute(interaction) {
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const amount = interaction.options.getInteger("amount") ?? 100;
      if (target.id === userId) { await interaction.reply({ content: "❌ Can't challenge yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't challenge bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId);
      if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.reply({ content: `❌ Need **${amount.toLocaleString()} V-Bucks**.` }); return; }
      const targetUser = getUser(target.id);
      if (!targetUser.infiniteVbucks && targetUser.vbucks < amount) { await interaction.reply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
      progressQuest(userId, "challenge_flip");
      updateUser(userId, { coinflipsPlayed: (challenger.coinflipsPlayed ?? 0) + 1 });
      const challengeId = `${userId}_${target.id}_${Date.now()}`;
      const embed = new EmbedBuilder().setTitle("🪙 Coin Flip Challenge!").setDescription(`<@${userId}> challenged <@${target.id}>!\n\n💰 **Bet:** ${amount.toLocaleString()} V-Bucks\n\n<@${target.id}>, pick your side!`).setColor(0xf4a01a).setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`flip_heads_${challengeId}`).setLabel("🪙 Heads").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_tails_${challengeId}`).setLabel("🪙 Tails").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_decline_${challengeId}`).setLabel("❌ Decline").setStyle(ButtonStyle.Danger));
      const msg = await interaction.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });
      setCoinflipChallenge(challengeId, { challengerId: userId, challengedId: target.id, amount });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id || b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.user.id !== target.id && !btn.customId.includes("decline")) { await btn.reply({ content: "❌ Only the challenged player can pick!", ephemeral: true }); return; }
        const challenge = getCoinflipChallenge(challengeId);
        if (!challenge) { await btn.update({ content: "❌ Challenge expired.", embeds: [], components: [] }); return; }
        if (btn.customId.includes("decline")) { deleteCoinflipChallenge(challengeId); await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Challenge Declined").setDescription(`<@${target.id}> declined.`).setColor(0xff0000).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
        const pickedHeads = btn.customId.includes("heads");
        const result = Math.random() < 0.5 ? "heads" : "tails";
        const won = (pickedHeads && result === "heads") || (!pickedHeads && result === "tails");
        const winnerId = won ? target.id : userId, loserId = won ? userId : target.id;
        if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
        addVbucks(winnerId, amount); addXP(winnerId, 100);
        const winner = getUser(winnerId); winner.coinflipsWon = (winner.coinflipsWon ?? 0) + 1;
        checkAndAwardAchievements(winnerId);
        progressQuest(won ? target.id : userId, "win_coinflip");
        deleteCoinflipChallenge(challengeId);
        await btn.update({ embeds: [new EmbedBuilder().setTitle(`🪙 The coin landed on **${result.toUpperCase()}**!`).setDescription(`${btn.user.username} picked **${pickedHeads ? "Heads" : "Tails"}**.\n\n🏆 **<@${winnerId}> wins ${amount.toLocaleString()} V-Bucks!**\n💸 <@${loserId}> loses ${amount.toLocaleString()} V-Bucks.`).setColor(won ? 0x00ff00 : 0xff0000).setTimestamp()], components: [], content: "" });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") { deleteCoinflipChallenge(challengeId); interaction.editReply({ content: "⏰ Challenge expired.", embeds: [], components: [] }).catch(() => {}); } });
    },
  },

  // ── /savetheworld ────────────────────────
  {
    data: new SlashCommandBuilder().setName("savetheworld").setDescription("View your Save the World quests and earn XP to level up"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const buildSTWEmbed = () => {
        const user = getUser(userId), li = calculateLevelFromXP(user.xp);
        const bar = "█".repeat(Math.round((li.xpInLevel / li.xpForNext) * 10)) + "░".repeat(10 - Math.round((li.xpInLevel / li.xpForNext) * 10));
        const questLines = user.quests.map((q) => { const done = q.completed ? "✅" : "🔲"; const qb = "█".repeat(Math.round((q.current / q.required) * 8)) + "░".repeat(8 - Math.round((q.current / q.required) * 8)); return `${done} **${q.label}**\n   \`${qb}\` ${q.current}/${q.required} · +${q.xpReward} XP`; });
        return new EmbedBuilder().setTitle("⚡ Save the World").setDescription(`**${interaction.user.username}** — Level **${user.level}** · **${user.boxes}** box(es)\n\n**XP Progress:**\n\`${bar}\` ${li.xpInLevel}/${li.xpForNext}\n\n**Daily Quests:**\n\n${questLines.join("\n\n")}\n\n*Quests reset every 24h. Level up to earn STW Boxes!*`).setColor(0xff6600).setFooter({ text: "Complete quests to level up and earn STW Boxes!" }).setTimestamp();
      };
      const buildSTWRow = () => { const user = getUser(userId); return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`stw_openbox`).setLabel(user.boxes > 0 ? `🎁 Open Box (${user.boxes} available)` : "🎁 No Boxes Yet").setStyle(user.boxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(user.boxes === 0), new ButtonBuilder().setCustomId(`stw_refresh`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Primary)); };
      const msg = await interaction.reply({ embeds: [buildSTWEmbed()], components: [buildSTWRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId === "stw_refresh") { resetQuestsIfNeeded(userId); await btn.update({ embeds: [buildSTWEmbed()], components: [buildSTWRow()] }); return; }
        if (btn.customId === "stw_openbox") {
          const freshUser = getUser(userId);
          if (freshUser.boxes <= 0) { await btn.reply({ content: "❌ No boxes!", ephemeral: true }); return; }
          updateUser(userId, { boxes: freshUser.boxes - 1, boxesOpened: (freshUser.boxesOpened ?? 0) + 1 }); checkAndAwardAchievements(userId);
          let resultEmbed;
          if (Math.random() < 0.2) { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); }
          else { const stwSkin = await getRandomStwSkin(); if (stwSkin) { addSkinToInventory(userId, stwSkin.id, stwSkin.name); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`${getRarityEmoji(stwSkin.rarity)} **${stwSkin.name}**!\n✨ Rarity: **${stwSkin.rarity}**\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(getRarityColor(stwSkin.rarity)).setImage(stwSkin.imageUrl).setTimestamp(); }
          else { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); } }
          await btn.reply({ embeds: [resultEmbed] });
          await interaction.editReply({ components: [buildSTWRow()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /founderspack (UNIFIED) ──────────────
  {
    data: new SlashCommandBuilder().setName("founderspack").setDescription("Founders Pack — view bot quests (auto-complete), open Founders Boxes, and more"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!user.hasFoundersPack) {
        if ((user.foundersBoxes ?? 0) > 0) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Waiting!").setDescription(`You have **${user.foundersBoxes} Founders Box${user.foundersBoxes > 1 ? "es" : ""}** waiting — but no **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when a Founders Pack appears!`).setColor(0xffd700).setImage(FP_PACK_IMAGE).setTimestamp()] }); return; }
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔒 Founders Pack Required").setDescription(`You don't own a **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when a Founders Pack appears!\n\n**Once unlocked you get:**\n• Bot-related quests that auto-complete\n• Founders Boxes worth 100–550 V-Bucks each\n• 5% chance for a 🌟 God Chest from each box`).setColor(0xff4444).setImage(FP_PACK_IMAGE).setTimestamp()] }); return;
      }
      let autoAwardMsg = "";
      const { newBoxes, quests: checkedQuests } = checkFoundersQuests(userId);
      if (newBoxes > 0) autoAwardMsg = `\n\n🎉 **${newBoxes} quest${newBoxes > 1 ? "s" : ""} completed — +${newBoxes} Founders Box${newBoxes > 1 ? "es" : ""}!**`;
      const allDone = checkedQuests.length === 0 || checkedQuests.every((q) => q.awardedBox);
      if (allDone) assignFoundersQuests(userId);

      const buildFPEmbed = () => {
        const fu = getUser(userId);
        const quests = fu.foundersQuestPending ?? [];
        const questLines = quests.map((q) => {
          const current = Math.min((fu[q.stat] ?? 0) - (q.baseline ?? 0), q.required);
          const qb = "█".repeat(Math.round((current / q.required) * 8)) + "░".repeat(8 - Math.round((current / q.required) * 8));
          const done = current >= q.required;
          return `${done ? "✅" : "🔲"} **${q.label}**\n   \`${qb}\` ${current}/${q.required}${done ? " *(auto-awarded!)*" : ""}`;
        });
        return new EmbedBuilder().setTitle("🌟 Founders Pack")
          .setDescription(`Welcome, Founder! 🎉${autoAwardMsg}\n\n📦 **Founders Boxes:** ${fu.foundersBoxes}\n📬 **Boxes Opened:** ${fu.foundersBoxesOpened ?? 0}\n\n**Bot Quests** *(auto-complete as you play!)*\n\n${questLines.length ? questLines.join("\n\n") : "*No quests — click Refresh!*"}\n\n**Box Rewards:**\n> 💰 100 V-Bucks — *40%*\n> 💰 200 V-Bucks — *30%*\n> 💰 350 V-Bucks — *20%*\n> 💰 550 V-Bucks — *10%*\n> 🌟 God Chest — *5%*`)
          .setColor(0xffd700).setImage(FP_BOX_IMAGE).setTimestamp();
      };
      const buildFPRow = () => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("fp_open").setLabel(fu.foundersBoxes > 0 ? `📦 Open Box (${fu.foundersBoxes} available)` : "📦 No Boxes").setStyle(fu.foundersBoxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(fu.foundersBoxes === 0),
          new ButtonBuilder().setCustomId("fp_refresh").setLabel("🔄 Check Quests").setStyle(ButtonStyle.Primary)
        );
      };
      const msg = await interaction.reply({ embeds: [buildFPEmbed()], components: [buildFPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId === "fp_refresh") {
          const { newBoxes: nb2 } = checkFoundersQuests(userId);
          const fu2 = getUser(userId);
          if ((fu2.foundersQuestPending ?? []).every((q) => q.awardedBox)) assignFoundersQuests(userId);
          await btn.update({ embeds: [buildFPEmbed()], components: [buildFPRow()] }); return;
        }
        if (btn.customId === "fp_open") {
          const fu = getUser(userId);
          if ((fu.foundersBoxes ?? 0) <= 0) { await btn.reply({ content: "❌ No Founders Boxes!", ephemeral: true }); return; }
          updateUser(userId, { foundersBoxes: fu.foundersBoxes - 1, foundersBoxesOpened: (fu.foundersBoxesOpened ?? 0) + 1 });
          const godChestChance = boostedChance(5, fu.activeLuck ?? "none");
          if (roll(godChestChance)) {
            const upd = getUser(userId); upd.godChest = (upd.godChest ?? 0) + 1;
            const godRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fp_open_godchest").setLabel("🌟 Open God Chest").setStyle(ButtonStyle.Success));
            await btn.reply({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🌟 GOD CHEST!").setDescription("A **GOLD GOD CHEST** appeared from your Founders Box!\n\n> ⚡ This is extremely rare — do you dare open it?").setFooter({ text: "Click to open!" })], components: [godRow] });
            const godMsg = await btn.fetchReply();
            const godCol = godMsg.createMessageComponentCollector({ time: 60000 });
            godCol.on("collect", async (b2) => {
              if (b2.user.id !== userId) return b2.reply({ content: "❌ Not your chest!", ephemeral: true });
              await openGodChestInteraction(b2, userId); godCol.stop();
            });
          } else {
            const won = rollFoundersBoxVbucks(); addVbucks(userId, won);
            const afterUser = getUser(userId);
            await btn.reply({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Opened!").setDescription(`🎉 You found **${won.toLocaleString()} V-Bucks** inside!\n\n💳 **New balance:** ${afterUser.infiniteVbucks ? "∞" : afterUser.vbucks.toLocaleString()} V-Bucks\n📦 **Boxes remaining:** ${afterUser.foundersBoxes}`).setColor(0xffd700).setTimestamp()] });
          }
          await interaction.editReply({ components: [buildFPRow()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /inventory ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("inventory").setDescription("View your Fortnite skin collection and items"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const names = Object.values(user.inventoryNames);
      const luck = user.activeLuck === "none" ? "None" : { normal: "🍀 Luck Potion (+15%)", xtra: "🔮 Xtra Luck Potion (+40%)", godly: "⚡ Godly Luck Potion (+80%)" }[user.activeLuck];
      const totalPages = Math.max(1, Math.ceil(names.length / 10));
      let page = 0;
      const buildInvPage = (p) => {
        const slice = names.slice(p * 10, p * 10 + 10);
        const lines = slice.map((name, i) => `${p * 10 + i + 1}. **${name}**`);
        const matInfo = user.buildCharges > 0 ? `${BUILD_MATS[user.buildMaterial]?.label ?? "🪵 Wood"} — ${user.buildCharges} charge${user.buildCharges !== 1 ? "s" : ""}` : "None";
        const itemsSection = `**Items:**\n🍀 Luck: ${user.luckPotion || 0} | 🔮 Xtra: ${user.xtraLuckPotion || 0} | ⚡ Godly: ${user.godlyLuckPotion || 0}\n🌟 God Chests: ${user.godChest || 0} | 🔵 Mysterious: ${user.mysteriousChest || 0}\n📦 Founders Boxes: ${user.foundersBoxes || 0} | 🏗️ Build: ${matInfo}`;
        const embed = new EmbedBuilder().setTitle(`🎒 ${interaction.user.username}'s Inventory`).setDescription((lines.length ? lines.join("\n") + "\n\n" : "*No skins yet.*\n\n") + itemsSection + `\n\n💰 **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks** | ✨ Luck: **${luck}**`).setColor(0x00d4ff).setFooter({ text: `Page ${p + 1} of ${totalPages} • ${names.length} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`inv_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0), new ButtonBuilder().setCustomId(`inv_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1));
        return { embed, row };
      };
      const { embed, row } = buildInvPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => { if (btn.customId === "inv_prev") page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1); await btn.update({ ...buildInvPage(page) }); });
      collector.on("end", async () => { const { embed: e } = buildInvPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /trade ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("trade").setDescription("Offer a skin trade with another player").addUserOption((o) => o.setName("player").setDescription("Player to trade with").setRequired(true)),
    async execute(interaction) {
      const initiatorId = interaction.user.id, target = interaction.options.getUser("player", true);
      if (target.id === initiatorId) { await interaction.reply({ content: "❌ Can't trade with yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't trade with bots!" }); return; }
      resetQuestsIfNeeded(initiatorId); addInteraction(initiatorId);
      const initUser = getUser(initiatorId), targUser = getUser(target.id);
      const initSkins = Object.entries(initUser.inventoryNames), targSkins = Object.entries(targUser.inventoryNames);
      if (!initSkins.length) { await interaction.reply({ content: "❌ You have no skins to trade!" }); return; }
      if (!targSkins.length) { await interaction.reply({ content: `❌ <@${target.id}> has no skins!` }); return; }
      let initPick = null, targPick = null;
      const initRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_initiator`).setPlaceholder(`${interaction.user.username}, pick your skin...`).addOptions(initSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
      const msg = await interaction.reply({ content: `<@${initiatorId}> <@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> wants to trade with <@${target.id}>!\n\n**<@${initiatorId}>** — pick your skin below.`).setColor(0x00d4ff).setFooter({ text: "Expires in 2 minutes" }).setTimestamp()], components: [initRow], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 2 * 60 * 1000, filter: (i) => i.user.id === initiatorId || i.user.id === target.id });
      collector.on("collect", async (i) => {
        if (i.isStringSelectMenu()) {
          if (i.customId === "trade_initiator" && i.user.id === initiatorId) {
            initPick = { key: i.values[0], name: initUser.inventoryNames[i.values[0]] };
            const targetRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_target`).setPlaceholder(`${target.username}, pick your skin...`).addOptions(targSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> offers **${initPick.name}**.\n\n<@${target.id}>, pick what you'd like to offer!`).setColor(0xf4a01a).setTimestamp()], components: [targetRow] }); return;
          }
          if (i.customId === "trade_target" && i.user.id === target.id) {
            if (!initPick) { await i.reply({ content: "❌ Wait for the other player!", ephemeral: true }); return; }
            targPick = { key: i.values[0], name: targUser.inventoryNames[i.values[0]] };
            const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trade_confirm_initiator").setLabel(`✅ ${interaction.user.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_confirm_target").setLabel(`✅ ${target.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Confirm Trade").setDescription(`**<@${initiatorId}>** offers: **${initPick.name}**\n**<@${target.id}>** offers: **${targPick.name}**\n\nBoth must confirm!`).setColor(0x1a9b1a).setTimestamp()], components: [confirmRow] }); return;
          }
        }
        if (i.isButton()) {
          if (i.customId === "trade_cancel") { await i.update({ content: "❌ Trade cancelled.", embeds: [], components: [] }); collector.stop(); return; }
          if (i.customId === "trade_confirm_initiator" && i.user.id !== initiatorId) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && i.user.id !== target.id) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && initPick && targPick) {
            const fI = getUser(initiatorId), fT = getUser(target.id);
            delete fI.inventoryNames[initPick.key]; fI.inventory = fI.inventory.filter((id) => id !== initPick.key.split("_")[0]); fI.inventoryNames[targPick.key + "_t"] = targPick.name; fI.inventory.push(targPick.key.split("_")[0]);
            delete fT.inventoryNames[targPick.key]; fT.inventory = fT.inventory.filter((id) => id !== targPick.key.split("_")[0]); fT.inventoryNames[initPick.key + "_t"] = initPick.name; fT.inventory.push(initPick.key.split("_")[0]);
            fI.tradesCompleted = (fI.tradesCompleted ?? 0) + 1; fT.tradesCompleted = (fT.tradesCompleted ?? 0) + 1;
            updateUser(initiatorId, fI); updateUser(target.id, fT); checkAndAwardAchievements(initiatorId); checkAndAwardAchievements(target.id);
            await i.update({ embeds: [new EmbedBuilder().setTitle("✅ Trade Complete!").setDescription(`**<@${initiatorId}>** received **${targPick.name}**\n**<@${target.id}>** received **${initPick.name}**`).setColor(0x00ff00).setTimestamp()], components: [], content: "" });
            collector.stop();
          }
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Trade expired.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /resetshop ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("resetshop").setDescription("Force the Item Shop to reset with 5 new skins").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const skins = await getRandomShopSkins(5);
      setItemShop(skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: 1500 })));
      const lines = skins.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · ${s.rarity}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🛒 Item Shop Reset!").setDescription(`New skins:\n\n${lines.join("\n")}`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /leaderboard ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("leaderboard").setDescription("View top players ranked by skins, V-Bucks, or level"),
    async execute(interaction) {
      await interaction.deferReply();
      let mode = "skins";
      const buildLBEmbed = async (m) => {
        const guild = interaction.guild, allUsers2 = getAllUsers();
        const entries = await Promise.all(Object.entries(allUsers2).map(async ([uid, d]) => {
          let name = `User ${uid.slice(-4)}`;
          if (guild) { try { const mem = await guild.members.fetch(uid).catch(() => null); if (mem) name = mem.displayName; } catch {} }
          const lvl = calculateLevelFromXP(d.xp);
          return { uid, name, skins: d.inventory.length, vbucks: d.vbucks, level: lvl.level, xp: d.xp };
        }));
        const sorted = [...entries].sort((a, b) => m === "skins" ? b.skins - a.skins : m === "vbucks" ? b.vbucks - a.vbucks : b.xp - a.xp);
        const medals = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `**${r}.**`;
        const modeLabel = m === "skins" ? "🎮 Most Skins" : m === "vbucks" ? "💰 Most V-Bucks" : "⭐ Highest Level";
        const lines2 = sorted.slice(0, 10).map((p, i) => `${medals(i + 1)} **${p.name}** — ${m === "skins" ? `${p.skins} skin(s)` : m === "vbucks" ? `${p.vbucks.toLocaleString()} V-Bucks` : `Level ${p.level} · ${p.xp.toLocaleString()} XP`}`);
        return new EmbedBuilder().setTitle(`🏆 Leaderboard — ${modeLabel}`).setDescription(lines2.length ? lines2.join("\n") : "No players yet!").setColor(0xf4a01a).setTimestamp();
      };
      const buildLBRow = (m) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("lb_skins").setLabel("🎮 Most Skins").setStyle(m === "skins" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "skins"), new ButtonBuilder().setCustomId("lb_vbucks").setLabel("💰 Most V-Bucks").setStyle(m === "vbucks" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "vbucks"), new ButtonBuilder().setCustomId("lb_level").setLabel("⭐ Highest Level").setStyle(m === "level" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m === "level"));
      const embed = await buildLBEmbed(mode);
      const msg = await interaction.editReply({ embeds: [embed], components: [buildLBRow(mode)] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });
      collector.on("collect", async (btn) => {
        if (btn.customId === "lb_skins") mode = "skins"; else if (btn.customId === "lb_vbucks") mode = "vbucks"; else mode = "level";
        await btn.update({ embeds: [await buildLBEmbed(mode)], components: [buildLBRow(mode)] });
      });
      collector.on("end", async () => { await interaction.editReply({ embeds: [await buildLBEmbed(mode)], components: [] }).catch(() => {}); });
    },
  },

  // ── /daily ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("daily").setDescription("Claim your daily V-Bucks reward — streaks add bonus V-Bucks!"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), last = user.lastDailyClaim ?? 0, since = now - last;
      if (since < 24 * 60 * 60 * 1000) {
        const left = 24 * 60 * 60 * 1000 - since, h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏰ Already Claimed!").setDescription(`Already claimed today.\n\n⏳ **Next claim in:** ${h}h ${m}m\n🔥 **Streak:** ${user.dailyStreak} day(s)`).setColor(0xff6600).setTimestamp()] }); return;
      }
      const newStreak = last === 0 || since >= 48 * 60 * 60 * 1000 ? 1 : (user.dailyStreak ?? 0) + 1;
      const reward = 150 + (newStreak - 1) * 100;
      const streakBroken = last !== 0 && since >= 48 * 60 * 60 * 1000 && (user.dailyStreak ?? 0) > 1;
      addVbucks(userId, reward); addXP(userId, 75);
      updateUser(userId, { lastDailyClaim: now, dailyStreak: newStreak });
      const updated = getUser(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Daily Reward Claimed!").setDescription(`${streakBroken ? "⚠️ **Streak reset!**\n\n" : newStreak > 1 ? `🎉 **${newStreak}-day streak!**\n\n` : ""}💰 **+${reward} V-Bucks**!\n💳 **Balance:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n🔥 **Streak:** ${newStreak} day(s)\n📅 **Tomorrow:** ${150 + newStreak * 100} V-Bucks`).setColor(newStreak >= 7 ? 0xf4a01a : newStreak >= 3 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "+75 XP bonus!" }).setTimestamp()] });
      checkAndAwardAchievements(userId);
    },
  },

  // ── /achievements ────────────────────────
  {
    data: new SlashCommandBuilder().setName("achievements").setDescription("View your achievements"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), earned = new Set(user.achievementsEarned ?? []);
      let page = 0; const PAGE_SIZE = 8;
      const buildAchPage = (p) => {
        const total = ALL_ACHIEVEMENTS.length, totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE)), safePage = Math.min(p, totalPages - 1);
        const slice = ALL_ACHIEVEMENTS.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
        const lines = slice.map((a) => earned.has(a.id) ? `🏆 ${a.emoji} **${a.title}**\n   *${a.description}*` : `🔒 ~~${a.emoji} ${a.title}~~\n   ||${a.description}||`);
        const bar = "█".repeat(Math.round((earned.size / total) * 10)) + "░".repeat(10 - Math.round((earned.size / total) * 10));
        const embed = new EmbedBuilder().setTitle(`🏆 ${interaction.user.username}'s Achievements`).setDescription(`\`${bar}\` ${earned.size}/${total}\n\n${lines.join("\n\n")}`).setColor(earned.size === total ? 0xf4a01a : 0x00d4ff).setFooter({ text: `Page ${safePage + 1} of ${totalPages}` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ach_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0), new ButtonBuilder().setCustomId(`ach_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1));
        return { embed, row, totalPages };
      };
      const { embed, row } = buildAchPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        const { totalPages } = buildAchPage(page);
        if (btn.customId === "ach_prev") page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1);
        await btn.update({ ...buildAchPage(page) });
      });
      collector.on("end", async () => { const { embed: e } = buildAchPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /refund ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("refund").setDescription("Request a refund for a skin you bought from the Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, user = getUser(userId);
      const shopSkins = user.shopSkins ?? [];
      if (!shopSkins.length) { await interaction.editReply({ content: "❌ No Item Shop skins eligible for refund." }); return; }
      const refundable = [], seen = new Set();
      for (const skinId of shopSkins) {
        if (seen.has(skinId) || !user.inventory.includes(skinId)) continue; seen.add(skinId);
        const nameKey = Object.keys(user.inventoryNames).find((k) => k.startsWith(skinId + "_")) ?? skinId;
        const name = user.inventoryNames[nameKey] ?? skinId, price = (user.shopSkinPrices ?? {})[skinId] ?? 800;
        const isFree = (user.freeSkinIds ?? []).includes(skinId);
        refundable.push({ skinId, nameKey, name, price, isFree });
      }
      if (!refundable.length) { await interaction.editReply({ content: "❌ None of your shop purchases are still in your inventory." }); return; }
      const options = refundable.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.isFree ? `${s.name} 🎁 (FREE)` : s.name).setDescription(s.isFree ? "⚠️ This was FREE — consequences await" : `Refund: ${s.price.toLocaleString()} V-Bucks`).setValue(s.skinId));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Item Shop Refund").setDescription("Select the skin to refund.\n\n⚠️ **Refunding a FREE skin will have consequences.**").setColor(0xff6600).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("refund_select").setPlaceholder("Choose a skin...").addOptions(options))] });
      const selectCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      selectCol.on("collect", async (sel) => {
        selectCol.stop("selected");
        const skinId = sel.values[0], skin = refundable.find((s) => s.skinId === skinId);
        if (skin.isFree) {
          await sel.update({ content: "Processing...", embeds: [], components: [] });
          const fu = getUser(userId), lostAmount = Math.floor(Math.abs(fu.vbucks) * 0.1), newVb = fu.vbucks - lostAmount;
          const invIdx = fu.inventory.indexOf(skinId); if (invIdx !== -1) fu.inventory.splice(invIdx, 1); delete fu.inventoryNames[skin.nameKey];
          const randomSkinEntry = Object.entries(fu.inventoryNames).filter(([k]) => !(fu.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"))[0];
          let randomRemoved = null;
          if (randomSkinEntry) { randomRemoved = randomSkinEntry[1]; const rsId = randomSkinEntry[0].replace(/_\d+$/, ""); const rsIdx = fu.inventory.indexOf(rsId); if (rsIdx !== -1) fu.inventory.splice(rsIdx, 1); delete fu.inventoryNames[randomSkinEntry[0]]; }
          updateUser(userId, { inventory: fu.inventory, inventoryNames: fu.inventoryNames, shopSkins: (fu.shopSkins ?? []).filter((s) => s !== skinId), vbucks: newVb, eliminatedUntil: Date.now() + 5 * 60 * 1000 });
          awardAchievement(userId, "scammed");
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📧 Email from Epic Games").setDescription(`**From:** noreply@epicgames.com\n**Subject:** Your Refund Request — Seriously?\n\n> We noticed you tried to refund **${skin.name}**, which you got for **FREE**.\n>\n> We've gone ahead and:\n> — Removed **${skin.name}** from your locker\n> — Deducted **${lostAmount.toLocaleString()} V-Bucks** (10% penalty)${randomRemoved ? `\n> — Also removed **${randomRemoved}** as a lesson` : ""}\n> — Suspended you for **5 minutes**\n>\n> Regards, Epic Games\n> *P.S. You are literally so dumb lol*`).setColor(0xff0000).setTimestamp()], components: [] }); return;
        }
        const coolLeft = ((user.refundCooldowns ?? {})[skinId] ?? 0) + 4 * 60 * 60 * 1000 - Date.now();
        if (coolLeft > 0) { await sel.update({ content: `⏳ Still under review. Try again in **${Math.floor(coolLeft / 3600000)}h ${Math.floor((coolLeft % 3600000) / 60000)}m**.`, embeds: [], components: [] }); return; }
        const fu2 = getUser(userId), hasBribes = Object.entries(fu2.inventoryNames).some(([k]) => !(fu2.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
        const btnRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("refund_bribe").setLabel(hasBribes ? "💸 Bribe Epic Games" : "💸 No skins to bribe with").setStyle(ButtonStyle.Danger).setDisabled(!hasBribes), new ButtonBuilder().setCustomId("refund_request").setLabel("🙏 Request Anyway (33%)").setStyle(ButtonStyle.Secondary));
        await sel.update({ embeds: [new EmbedBuilder().setTitle("⚠️ Refund Warning").setDescription(`Refunding **${skin.name}**.\n\n💰 **Refund:** ${skin.price.toLocaleString()} V-Bucks\n\n> 💸 **Bribe Epic** — sacrifice a skin for guaranteed approval\n> 🙏 **Request Anyway** — 33% chance`).setColor(0xff0000).setTimestamp()], components: [btnRow] });
        const btnCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        btnCol.on("collect", async (btn) => {
          btnCol.stop("clicked"); const fu3 = getUser(userId); let approved = false, bribedSkin = null;
          if (btn.customId === "refund_bribe") {
            const bribes = Object.entries(fu3.inventoryNames).filter(([k]) => !(fu3.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
            if (!bribes.length) { await btn.update({ content: "❌ No skins to bribe with!", embeds: [], components: [] }); return; }
            const bribe = bribes[Math.floor(Math.random() * bribes.length)]; bribedSkin = bribe[1]; const bsId = bribe[0].replace(/_\d+$/, ""); const bIdx = fu3.inventory.indexOf(bsId); if (bIdx !== -1) fu3.inventory.splice(bIdx, 1); delete fu3.inventoryNames[bribe[0]]; approved = true;
          } else approved = Math.random() < 0.33;
          if (approved) {
            const refIdx = fu3.inventory.indexOf(skinId); if (refIdx !== -1) fu3.inventory.splice(refIdx, 1); delete fu3.inventoryNames[skin.nameKey]; fu3.shopSkins = (fu3.shopSkins ?? []).filter((s) => s !== skinId);
            addVbucks(userId, skin.price); updateUser(userId, { inventory: fu3.inventory, inventoryNames: fu3.inventoryNames, shopSkins: fu3.shopSkins });
            awardAchievement(userId, "epic_likes_you"); checkAndAwardAchievements(userId);
            await btn.update({ embeds: [new EmbedBuilder().setTitle("✅ Refund Approved!").setDescription(`✅ **Epic approved your refund** for **${skin.name}**!\n💰 **+${skin.price.toLocaleString()} V-Bucks**${bribedSkin ? `\n\n🤝 Bribed with **${bribedSkin}** — they took it immediately.` : ""}`).setColor(0x00ff00).setTimestamp()], components: [] });
          } else {
            const c2 = fu3.refundCooldowns ?? {}; c2[skinId] = Date.now(); updateUser(userId, { refundCooldowns: c2 }); awardAchievement(userId, "epic_hates_you");
            await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Refund Denied!").setDescription(`❌ **Epic rejected** your refund for **${skin.name}**.\n\nNo reason given. Try again in **4 hours**.`).setColor(0xff0000).setTimestamp()], components: [] });
          }
        });
      });
    },
  },

  // ── /hack ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("hack").setDescription("(Admin) Hack Epic Games to give a player 13,500 V-Bucks").addUserOption((o) => o.setName("player").setDescription("Player to give V-Bucks to").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const target = interaction.options.getUser("player", true);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💻 Hacking...").setDescription("```\nBypassing Epic Games firewall...\nAccessing V-Bucks database...\nInjecting payload...\n```").setColor(0x00ff00).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2500));
      addVbucks(target.id, 13500); addInteraction(target.id);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Hack Successful!").setDescription(`<@${target.id}> received **13,500 V-Bucks!**\n\n*Epic Games will never know.*`).setColor(0x00ff00).setTimestamp()] });
    },
  },

  // ── /freevbucks ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("freevbucks").setDescription("Claim free V-Bucks from a totally legit website!"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), lostAmount = Math.floor(user.vbucks * 0.25);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🤑 Free V-Bucks Generator — 100% LEGIT!!").setDescription("**Step 1:** Enter your login ✅\n**Step 2:** Select amount: **FREE** ✅\n**Step 3:** Waiting for verification...\n\n*Please wait up to 7 days for V-Bucks to arrive!*").setColor(0x00ff00).setFooter({ text: "freevbucks4real.biz • Totally not a virus" }).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 3000));
      addVbucks(userId, -lostAmount);
      const updated = getUser(userId), ach = awardAchievement(userId, "scammed");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("😱 A Week Later...").setDescription(`You entered your login like a genius and lost **${lostAmount.toLocaleString()} V-Bucks** — 25% of everything.\n\nhaha.\n\n💳 **New balance:** ${updated.vbucks.toLocaleString()} V-Bucks${updated.vbucks <= 0 ? " *(broke)*" : ""}`).setColor(0xff0000).setTimestamp(), ...(ach ? [buildAchievementEmbed(ach)] : [])] });
    },
  },

  // ── /creatorcode ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("creatorcode").setDescription("Support a creator for a discount on the Item Shop").addStringOption((o) => o.setName("code").setDescription("Creator code (leave blank to remove)").setRequired(false)),
    async execute(interaction) {
      const userId = interaction.user.id; addInteraction(userId);
      const rawInput = interaction.options.getString("code");
      if (!rawInput || rawInput.trim() === "") {
        const user = getUser(userId);
        if (!user.hasCreatorCode) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("ℹ️ No Creator Code Active").setDescription("Use `/creatorcode <code>` to support a creator!").setColor(0x888888).setTimestamp()] }); return; }
        updateUser(userId, { hasCreatorCode: false, creatorDiscount: 0, freeSkinExpiry: 0, freeSkinRedeemed: false });
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Creator Code Removed").setColor(0xff6600).setTimestamp()] }); return;
      }
      const code = rawInput.toLowerCase().trim(), match = VALID_CODES[code];
      if (!match) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❓ Unknown Creator Code").setDescription(`**${rawInput}** isn't valid. Try \`tylajadee\`, \`qckdream\`, or \`clovel\`!`).setColor(0xff6600).setTimestamp()] }); return; }
      const user = getUser(userId), discountPct = Math.round(match.discount * 100);
      const updates = { hasCreatorCode: true, creatorDiscount: match.discount };
      if (match.freeSkin && !((user.freeSkinExpiry ?? 0) > Date.now() && !(user.freeSkinRedeemed ?? false))) { updates.freeSkinExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; updates.freeSkinRedeemed = false; }
      updateUser(userId, updates);
      let desc = `You're supporting **${match.displayName}**! 🙌\n\n**${discountPct}% discount** on the Item Shop!`;
      if (match.freeSkin) desc += `\n\n🎁 **Perk — Free Skin Week!** Get **one FREE skin** from the shop!`;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎉 Creator Code Applied!").setDescription(desc).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /zeropoint ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("zeropoint").setDescription("Interact with the mysterious Zero Point orb"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const player = getUser(userId);
      updateUser(userId, { zeropointUses: (player.zeropointUses ?? 0) + 1 });
      const buildZPEmbed = () => new EmbedBuilder().setTitle("🔵 The Zero Point").setDescription(`*A mysterious orb crackling with energy...*\n\n✨ **Donate a skin** — always get a weapon in return!\n> ⚡ SMGs & ARs: **30% chance for 25 ammo** — fire all at once!\n> 🔫 Other weapons: 1 ammo\n\n🌟 **Donate Founders Pack** — receive **2,500 V-Bucks**\n\n🍀 **Feed Luck Potion** → **50%** chance to upgrade to Xtra Luck Potion\n🔮 **Feed Xtra Luck Potion** → **25%** chance to upgrade to Godly Luck Potion`).setColor(0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp();
      const buildZPRow = () => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("zp_donate_skin").setLabel("🎮 Donate a Skin").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("zp_donate_founders").setLabel(fu.hasFoundersPack ? "🌟 Donate Founders Pack (+2,500 V-Bucks)" : "🌟 No Founders Pack").setStyle(fu.hasFoundersPack ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!fu.hasFoundersPack),
          new ButtonBuilder().setCustomId("zp_luck_potion").setLabel(fu.luckPotion > 0 ? `🍀 Feed Luck Potion (${fu.luckPotion})` : "🍀 No Luck Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.luckPotion ?? 0) === 0),
          new ButtonBuilder().setCustomId("zp_xtra_potion").setLabel(fu.xtraLuckPotion > 0 ? `🔮 Feed Xtra Potion (${fu.xtraLuckPotion})` : "🔮 No Xtra Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.xtraLuckPotion ?? 0) === 0)
        );
      };
      const msg = await interaction.reply({ embeds: [buildZPEmbed()], components: [buildZPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        collector.stop("interacted");
        const cu = getUser(userId);
        if (btn.customId === "zp_luck_potion") {
          if ((cu.luckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { luckPotion: cu.luckPotion - 1 });
          if (roll(50)) { updateUser(userId, { xtraLuckPotion: (cu.xtraLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🌀 Success! Luck Potion → Xtra Luck Potion").setDescription("The **Zero Point** crackled with energy!\n\nYour **Luck Potion** transformed into an **Xtra Luck Potion**! 🔮").setFooter({ text: "50% chance — you got lucky!" }).setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** consumed your **Luck Potion**... the transformation failed.").setFooter({ text: "50% chance — better luck next time!" }).setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_xtra_potion") {
          if ((cu.xtraLuckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Xtra Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { xtraLuckPotion: cu.xtraLuckPotion - 1 });
          if (roll(25)) { updateUser(userId, { godlyLuckPotion: (cu.godlyLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⚡ GODLY! Xtra Luck Potion → Godly Luck Potion!").setDescription("The **Zero Point** ERUPTED!\n\nYour **Xtra Luck Potion** ascended into a **Godly Luck Potion**! ⚡").setFooter({ text: "25% chance — incredible!" }).setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** tried to ascend your **Xtra Luck Potion**... and failed.").setFooter({ text: "25% chance — keep trying!" }).setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_donate_founders") {
          if (!cu.hasFoundersPack) { await btn.update({ content: "❌ No Founders Pack!", embeds: [], components: [] }); return; }
          updateUser(userId, { hasFoundersPack: false }); addVbucks(userId, 2500);
          const after = getUser(userId);
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🌟 The Zero Point Accepts Your Offering!").setDescription(`You offered your **Founders Pack**.\n\nThe orb pulses with golden energy...\n\n💰 **+2,500 V-Bucks!**\n💳 **New balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks\n\n*Your Founders Pack was consumed.*`).setColor(0xffd700).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] }); return;
        }
        if (btn.customId === "zp_donate_skin") {
          const entries = Object.entries(cu.inventoryNames);
          if (!entries.length) { await btn.update({ content: "❌ You have no skins to donate!", embeds: [], components: [] }); return; }
          const skinOpts = entries.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🔵 Choose Your Offering").setDescription("The Zero Point awaits.\n\nSelect a skin to sacrifice for a weapon:").setColor(0x4444ff).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("zp_skin_select").setPlaceholder("Choose a skin to sacrifice...").addOptions(skinOpts))] });
          const skinCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId && i.customId === "zp_skin_select" });
          skinCol.on("collect", async (sel) => {
            skinCol.stop("selected");
            const key = sel.values[0], skinName = cu.inventoryNames[key] ?? key, skinId = key.replace(/_\d+$/, "");
            const fu2 = getUser(userId), idx = fu2.inventory.indexOf(skinId); if (idx !== -1) fu2.inventory.splice(idx, 1); delete fu2.inventoryNames[key];
            updateUser(userId, { inventory: fu2.inventory, inventoryNames: fu2.inventoryNames });
            const weapon = randomWeapon(), isMulti = isMultiAmmoWeapon(weapon), getsMulti = isMulti && Math.random() < 0.3, ammoCount = getsMulti ? 25 : 1;
            const fu3 = getUser(userId); updateUser(userId, { weapons: [...(fu3.weapons ?? []), ...Array(ammoCount).fill(weapon.name)] });
            await sel.update({ embeds: [new EmbedBuilder().setTitle(getsMulti ? `⚡ JACKPOT — ${weapon.name} × 25!` : `${weapon.emoji} The Zero Point Rewards You!`).setDescription(getsMulti ? `You sacrificed **${skinName}** to the Zero Point.\n\n${weapon.emoji} **You received: ${weapon.name} × 25 ammo!**\n*"${weapon.description}"*\n\n⚡ Use \`/attack @user ${weapon.name}\` to fire all 25 shots at once!` : `You sacrificed **${skinName}**.\n\n${weapon.emoji} **You received: ${weapon.name}** *(1 ammo)*\n*"${weapon.description}"*\n\nUse \`/attack @user ${weapon.name}\`!`).setColor(getsMulti ? 0xffd700 : 0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] });
          });
          skinCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ The Zero Point lost interest.", embeds: [], components: [] }).catch(() => {}); });
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /attack ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("attack").setDescription("Attack another player with a weapon from your arsenal").addUserOption((o) => o.setName("target").setDescription("Player to attack").setRequired(true)).addStringOption((o) => o.setName("weapon").setDescription("Weapon to use").setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction) => {
      const userId = interaction.user.id, user = getUser(userId), focused = interaction.options.getFocused().toLowerCase();
      const weapons = [...(user.weapons ?? [])], unique = [...new Set(weapons)];
      const choices = unique.filter((w) => w.toLowerCase().includes(focused)).slice(0, 25).map((w) => { const ammo = weapons.filter((x) => x === w).length; const wi = getWeaponByName(w); return { name: `${w} — ${ammo} ammo${wi && isMultiAmmoWeapon(wi) && ammo > 1 ? " (fires all)" : ""}`, value: w }; });
      await interaction.respond(choices);
    },
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("target", true), weaponInput = interaction.options.getString("weapon", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't attack yourself." }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Bots have unlimited HP." }); return; }
      const user = getUser(userId), weapons = [...(user.weapons ?? [])];
      const weaponName = weapons.find((w) => w.toLowerCase() === weaponInput.toLowerCase()) ?? null;
      if (!weaponName) { const owned = [...new Set(weapons)]; await interaction.editReply({ content: `❌ You don't have **${weaponInput}**.${owned.length ? `\n\n**Arsenal:** ${owned.join(", ")}` : "\n\n*No weapons. Use \`/zeropoint\` or \`/fish\`.*"}` }); return; }
      const weaponInfo = getWeaponByName(weaponName), emoji = weaponInfo?.emoji ?? "🔫", desc2 = weaponInfo?.description ?? "A powerful weapon.", isMulti = weaponInfo ? isMultiAmmoWeapon(weaponInfo) : false;
      const ammoCount = weapons.filter((w) => w.toLowerCase() === weaponName.toLowerCase()).length, usedAmmo = isMulti ? ammoCount : 1;
      const newWeapons = [...weapons]; let removed = 0;
      for (let i = newWeapons.length - 1; i >= 0 && removed < usedAmmo; i--) { if (newWeapons[i].toLowerCase() === weaponName.toLowerCase()) { newWeapons.splice(i, 1); removed++; } }
      updateUser(userId, { weapons: newWeapons });
      const HIT_CHANCE = 0.25;
      const targetUser = getUser(target.id);
      const hasShield = (targetUser.buildCharges ?? 0) > 0;
      if (isMulti && usedAmmo > 1) {
        let hits = 0, misses = 0;
        for (let i = 0; i < usedAmmo; i++) { if (Math.random() < HIT_CHANCE) hits++; else misses++; }
        // Absorb hits with build charges
        let shieldAbsorbed = 0;
        if (hasShield && hits > 0) {
          shieldAbsorbed = Math.min(hits, targetUser.buildCharges);
          hits -= shieldAbsorbed;
          const newCharges = targetUser.buildCharges - shieldAbsorbed;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        const shieldLine = shieldAbsorbed > 0 ? `\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed ${shieldAbsorbed} hit(s)!**` : "";
        if (hits > 0) {
          const elimMs = Math.min(hits * 10 * 60 * 1000, 120 * 60 * 1000);
          const existing = (getUser(target.id).eliminatedUntil ?? 0) > Date.now() ? getUser(target.id).eliminatedUntil : Date.now();
          updateUser(target.id, { eliminatedUntil: existing + elimMs });
          const totalMins = Math.round(elimMs / 60000);
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} unloaded on ${target.username}!`).setDescription(`Fired **${usedAmmo} rounds** of **${weaponName}**!\n\n📊 **${hits} hit(s), ${misses} miss(es)** *(+${shieldAbsorbed} blocked)*${shieldLine}\n\n☠️ **${target.username}** eliminated for **${totalMins} minutes!**\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} missed every shot!`).setDescription(`Fired **${usedAmmo} rounds**... **0 hits, ${misses} misses.**${shieldLine}\n\n🔫 All ammo wasted.`).setColor(0x888888).setTimestamp()] });
        }
      } else {
        const hit = Math.random() < HIT_CHANCE;
        let blocked = false;
        if (hit && hasShield) {
          blocked = true;
          const newCharges = targetUser.buildCharges - 1;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        if (hit && !blocked) {
          updateUser(target.id, { eliminatedUntil: Date.now() + 10 * 60 * 1000 });
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Direct Hit!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n💥 **ELIMINATED!** ${target.username} can't interact for **10 minutes**.\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else if (blocked) {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Hit Blocked!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed the shot!**\n\nOne build charge consumed. 🔫`).setColor(0x888888).setTimestamp()] });
        } else {
          const mm = ["missed every shot", "forgot to take the safety off", "aimed for the head and hit a tree"][Math.floor(Math.random() * 3)];
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Missed!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**...\n\n*"${desc2}"*\n\n💨 **MISSED!** ${interaction.user.username} ${mm}.\n\n🔫 **${weaponName}** consumed.`).setColor(0x888888).setTimestamp()] });
        }
      }
    },
  },

  // ── /reboot ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("reboot").setDescription("Reboot a downed player for 299 V-Bucks").addUserOption((o) => o.setName("player").setDescription("Player to reboot").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.editReply({ content: "❌ Can't reboot a bot." }); return; }
      if (!isEliminated(target.id)) { await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Player is Alive").setDescription(`**${target.username}** is not downed!`).setColor(0x00ff00).setTimestamp()] }); return; }
      const cu = getUser(userId);
      if (!cu.infiniteVbucks && cu.vbucks < 299) { await interaction.editReply({ content: `❌ Need **299 V-Bucks** to reboot.` }); return; }
      if (!cu.infiniteVbucks) addVbucks(userId, -299);
      updateUser(target.id, { eliminatedUntil: 0 });
      const after = getUser(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Player Rebooted!").setDescription(`**${interaction.user.username}** spent **299 V-Bucks** to reboot **${target.username}**!\n\n${target.username} is back!\n\n💳 **Your balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /useluckpotion (can target others) ───
  {
    data: new SlashCommandBuilder().setName("useluckpotion").setDescription("Use a luck potion on yourself or another player!").addStringOption((o) => o.setName("type").setDescription("Which luck potion?").setRequired(true).addChoices({ name: "🍀 Luck Potion (+15%)", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion (+40%)", value: "xtraLuckPotion" }, { name: "⚡ Godly Luck Potion (+80%)", value: "godlyLuckPotion" })).addUserOption((o) => o.setName("player").setDescription("Player to give the luck boost to (default: yourself)").setRequired(false)),
    async execute(interaction) {
      const type = interaction.options.getString("type");
      const targetUser = interaction.options.getUser("player") ?? interaction.user;
      const userId = interaction.user.id;
      const player = getUser(userId);
      const names = { luckPotion: "Luck Potion", xtraLuckPotion: "Xtra Luck Potion", godlyLuckPotion: "Godly Luck Potion" };
      if ((player[type] ?? 0) <= 0) { await interaction.reply({ content: `❌ You don't have any **${names[type]}**!`, ephemeral: true }); return; }
      const targetId = targetUser.id;
      const isSelf = targetId === userId;
      const luckKey = type === "luckPotion" ? "normal" : type === "xtraLuckPotion" ? "xtra" : "godly";
      player[type]--;
      updateUser(targetId, { activeLuck: luckKey });
      const INFO = { normal: { emoji: "🍀", label: "Luck Potion", boost: "+15%", color: "#2ecc71" }, xtra: { emoji: "🔮", label: "Xtra Luck Potion", boost: "+40%", color: "#9b59b6" }, godly: { emoji: "⚡", label: "Godly Luck Potion", boost: "+80%", color: "#f1c40f" } };
      const info = INFO[luckKey];
      const targetData = getUser(targetId);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} ${info.label} Activated!`).setDescription(isSelf ? `All your luck-based chances boosted by **${info.boost}**!` : `You gifted your **${info.label}** to <@${targetId}>!\n\nTheir luck-based chances are boosted by **${info.boost}**!`).addFields({ name: "God Chest Chance", value: `${boostedChance(5, luckKey)}%`, inline: true }, { name: "Inf V-Bucks Chance", value: `${boostedChance(15, luckKey)}%`, inline: true }, { name: "10k V-Bucks Chance", value: `${boostedChance(25, luckKey)}%`, inline: true }).setFooter({ text: isSelf ? "Active on yourself" : `Active on ${targetUser.username}` })] });
      if (!isSelf && interaction.channel?.send) await interaction.channel.send({ content: `<@${targetId}>`, embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} You received a Luck Boost!`).setDescription(`<@${userId}> used their **${info.label}** on you!\n\nYour luck-based chances are boosted by **${info.boost}**!`)] });
    },
  },

  // ── /skinalogue ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("skinalogue").setDescription("Browse all catchable Fortnite skins").addStringOption((o) => o.setName("search").setDescription("Filter by name").setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply();
      const query = (interaction.options.getString("search") ?? "").trim().toLowerCase();
      const allSkins = await fetchFortniteSkins(), filtered = query ? allSkins.filter((s) => s.name.toLowerCase().includes(query)) : allSkins;
      let page = 0;
      const buildSkinPage = (p) => {
        const total = filtered.length, totalPages = Math.max(1, Math.ceil(total / 8)), safePage = Math.min(p, totalPages - 1);
        const slice = filtered.slice(safePage * 8, safePage * 8 + 8);
        const embed = new EmbedBuilder().setTitle(query ? `📖 Skinalogue — "${query}"` : "📖 Skinalogue — All Skins").setDescription(total === 0 ? `No skins found for **"${query}"**.` : slice.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · *${s.rarity}* · \`${getSpawnPercent(s.rarity)}%\` spawn`).join("\n")).setColor(0x00d4ff).setFooter({ text: total === 0 ? "No results" : `Page ${safePage + 1} of ${totalPages} • ${total} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`skin_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0 || total === 0), new ButtonBuilder().setCustomId(`skin_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1 || total === 0));
        return { embed, row, totalPages, safePage };
      };
      const { embed, row } = buildSkinPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      if (!filtered.length) return;
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === interaction.user.id });
      collector.on("collect", async (btn) => {
        const { totalPages, safePage } = buildSkinPage(page);
        if (btn.customId === "skin_prev") page = Math.max(0, safePage - 1); else page = Math.min(totalPages - 1, safePage + 1);
        await btn.update({ ...buildSkinPage(page) });
      });
      collector.on("end", async () => { const { embed: e } = buildSkinPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ═══════════════ NEW COMMANDS ═══════════════

  // ── /llama ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("llama").setDescription("Open a Supply Llama! 1-hour cooldown — great random rewards inside"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 60 * 60 * 1000;
      const last = user.lastLlama ?? 0;
      if (now - last < cooldown) {
        const left = cooldown - (now - last), h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 No Llamas Available").setDescription(`The next Supply Llama spawns in:\n\n⏳ **${h > 0 ? h + "h " : ""}${m}m ${s}s**\n\n*Llamas are rare! Come back soon.*`).setColor(0x888888).setImage(LLAMA_IMAGE).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 A Supply Llama appeared!").setDescription("You spotted a **Supply Llama** grazing nearby...\n\nPicking the locks...").setColor(0xf4a01a).setImage(LLAMA_IMAGE).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2000));
      updateUser(userId, { lastLlama: now, llamaOpens: (user.llamaOpens ?? 0) + 1 });
      const luck = user.activeLuck;
      // Loot table (weighted)
      const LLAMA_TABLE = [
        { weight: 20, fn: () => { addVbucks(userId, 200); return { desc: "💰 **200 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 15, fn: () => { addVbucks(userId, 500); return { desc: "💰 **500 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 10, fn: () => { addVbucks(userId, 1000); return { desc: "💰 **1,000 V-Bucks!**", color: 0xf4a01a }; } },
        { weight: 15, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons ?? []), w.name] }); return { desc: `${w.emoji} **${w.name}** *(weapon)!*`, color: 0xff6600 }; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes ?? 0) + 2 }); return { desc: "📦 **2 STW Boxes**!", color: 0xff6600 }; } },
        { weight: 8,  fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion ?? 0) + 1 }); return { desc: "🍀 **Luck Potion**!", color: 0x2ecc71 }; } },
        { weight: 6,  fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion ?? 0) + 1 }); return { desc: "🔮 **Xtra Luck Potion**!", color: 0x9b4dca }; } },
        { weight: boostedChance(4, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return { desc: `${getRarityEmoji(skin.rarity)} **${skin.name}** *(${skin.rarity} skin!)* 🎮`, color: getRarityColor(skin.rarity), image: skin.imageUrl }; } },
        { weight: boostedChance(3, luck), fn: () => { updateUser(userId, { foundersBoxes: (getUser(userId).foundersBoxes ?? 0) + 1 }); return { desc: "📦 **Founders Box!**", color: 0xffd700 }; } },
        { weight: boostedChance(2, luck), fn: () => { updateUser(userId, { godChest: (getUser(userId).godChest ?? 0) + 1 }); return { desc: "🌟 **GOD CHEST!** Extremely rare!", color: 0xffd700 }; } },
      ];
      const total = LLAMA_TABLE.reduce((a, b) => a + b.weight, 0);
      let r = Math.random() * total;
      let chosen = LLAMA_TABLE[0];
      for (const item of LLAMA_TABLE) { r -= item.weight; if (r <= 0) { chosen = item; break; } }
      const result = await chosen.fn();
      checkAndAwardAchievements(userId);
      const embed = new EmbedBuilder().setTitle("🦙 Supply Llama Opened!").setDescription(`You cracked open the **Supply Llama** and found...\n\n${result.desc}\n\n+50 XP earned!`).setColor(result.color).setFooter({ text: "Next llama available in 1 hour" }).setTimestamp();
      if (result.image) embed.setThumbnail(result.image);
      addXP(userId, 50);
      const godChestRow = result.desc.includes("GOD CHEST") ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("llama_open_godchest").setLabel("🌟 Open God Chest!").setStyle(ButtonStyle.Success)) : null;
      await interaction.editReply({ embeds: [embed], ...(godChestRow ? { components: [godChestRow] } : {}) });
      if (godChestRow) {
        const gcMsg = await interaction.fetchReply();
        const gcCol = gcMsg.createMessageComponentCollector({ time: 60000 });
        gcCol.on("collect", async (btn) => {
          if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
          await openGodChestInteraction(btn, userId); gcCol.stop();
        });
        gcCol.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
      }
    },
  },

  // ── /fish ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("fish").setDescription("Grab your fishing rod and head to a named location! 15-minute cooldown").addStringOption((o) => o.setName("location").setDescription("Where to fish").setRequired(false).addChoices(...FISH_SPOTS.slice(0, 10).map((s) => ({ name: s, value: s })))),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 15 * 60 * 1000;
      if (now - (user.lastFish ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastFish ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎣 Still Fishing...").setDescription(`You just went fishing! Wait **${m}m ${s}s** before going again.\n\n*The fish need time to respawn!*`).setColor(0x888888).setTimestamp()] }); return;
      }
      const spot = interaction.options.getString("location") ?? FISH_SPOTS[Math.floor(Math.random() * FISH_SPOTS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎣 Fishing at ${spot}...`).setDescription("You cast your line into the water...\n\n*Waiting for a bite...*").setColor(0x0075e3).setTimestamp()] });
      const waitMs = 1500 + Math.random() * 2500;
      await new Promise((r) => setTimeout(r, waitMs));
      const catch_ = weightedFish();
      const resultDesc = catch_.action(userId);
      updateUser(userId, { lastFish: now, fishCaught: (user.fishCaught ?? 0) + 1 });
      addXP(userId, 60);
      checkAndAwardAchievements(userId);
      if (catch_.name === "Mythic Goldfish") awardAchievement(userId, "goldfish");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${catch_.emoji} You caught a ${catch_.name}!`).setDescription(`Fishing at **${spot}**...\n\n${resultDesc}!\n\n+60 XP earned!`).setColor(catch_.name === "Junk" ? 0x888888 : catch_.name === "Mythic Goldfish" ? 0xffd700 : 0x0075e3).setFooter({ text: "Next fishing trip in 15 minutes" }).setTimestamp()] });
    },
  },

  // ── /battlepass ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("battlepass").setDescription("View your Battle Pass progress and tier rewards"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const tier = getBattlePassTier(user.level, user.xp);
      const earnedRewards = BP_REWARDS.filter((r) => tier >= r.tier);
      const nextReward = BP_REWARDS.find((r) => r.tier > tier);
      const bar = "█".repeat(Math.round((tier / 100) * 20)) + "░".repeat(20 - Math.round((tier / 100) * 20));
      const rewardLines = BP_REWARDS.map((r) => `${tier >= r.tier ? "✅" : "🔒"} **Tier ${r.tier}:** ${r.reward}`);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎮 ${interaction.user.username}'s Battle Pass`).setDescription(`**Tier:** ${tier}/100\n\`${bar}\`\n\n${nextReward ? `**Next reward at Tier ${nextReward.tier}:** ${nextReward.reward}\n*Earn XP to level up your Battle Pass tier!*` : "🏆 **BATTLE PASS COMPLETE!**"}\n\n**All Rewards:**\n${rewardLines.join("\n")}`).setColor(tier >= 100 ? 0xffd700 : tier >= 50 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "Tier increases with bot level & XP" }).setTimestamp()] });
      if (tier >= 100) checkAndAwardAchievements(userId);
    },
  },

  // ── /stormwatch ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("stormwatch").setDescription("Check the storm — you might be safe, or you might be in it! 10-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 10 * 60 * 1000;
      if (now - (user.lastStorm ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastStorm ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Storm Already Checked").setDescription(`You already checked the storm recently.\n\nWait **${m}m ${s}s** before checking again.`).setColor(0x888888).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Checking Storm Position...").setDescription("Pulling up the storm map...\n\n*Triangulating your position...*").setColor(0x888888).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 1500));
      const event = rollStorm();
      const result = event.fn(userId);
      updateUser(userId, { lastStorm: now });
      if (event.name.includes("Safe") || event.name.includes("Eye")) {
        updateUser(userId, { stormsSurvived: (user.stormsSurvived ?? 0) + 1 });
        checkAndAwardAchievements(userId);
      }
      const pos = FORTNITE_POIS[Math.floor(Math.random() * FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🌪️ Storm Report — ${event.name}`).setDescription(`📍 **Your location:** ${pos}\n\n${result}!\n\n⏰ **Next circle closes in:** ${Math.floor(Math.random() * 3) + 1}m 30s`).setColor(event.color).setFooter({ text: "Next storm check in 10 minutes" }).setTimestamp()] });
    },
  },

  // ── /supply_drop ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("supply_drop").setDescription("Call in a Supply Drop from the Battle Bus! 30-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 30 * 60 * 1000;
      if (now - (user.lastSupplyDrop ?? 0) < cooldown) {
        const left = cooldown - (now - (user.lastSupplyDrop ?? 0)), m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop On Cooldown").setDescription(`A drop was already called. Next one in:\n\n⏳ **${m}m ${s}s**`).setColor(0x888888).setTimestamp()] }); return;
      }
      const location = FORTNITE_POIS[Math.floor(Math.random() * FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Incoming!").setDescription(`A Supply Drop was spotted over **${location}**!\n\n*Balloon descending...*`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setTimestamp()] });
      const landMs = 2000 + Math.random() * 2000;
      await new Promise((r) => setTimeout(r, landMs));
      updateUser(userId, { lastSupplyDrop: now, supplyDrops: (user.supplyDrops ?? 0) + 1 });
      const luck = user.activeLuck;
      const DROP_TABLE = [
        { weight: 25, fn: () => { addVbucks(userId, 300); return "💰 **300 V-Bucks**"; } },
        { weight: 20, fn: () => { addVbucks(userId, 750); return "💰 **750 V-Bucks**"; } },
        { weight: 20, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons ?? []), w.name, w.name] }); return `${w.emoji} **${w.name} × 2 ammo**`; } },
        { weight: 15, fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion ?? 0) + 1 }); return "🍀 **Luck Potion**"; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes ?? 0) + 1 }); return "📬 **STW Box**"; } },
        { weight: boostedChance(5, luck), fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion ?? 0) + 1 }); return "🔮 **Xtra Luck Potion!**"; } },
        { weight: boostedChance(3, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return `${getRarityEmoji(skin.rarity)} **${skin.name}** *(skin!)*`; } },
      ];
      const dtTotal = DROP_TABLE.reduce((a, b) => a + b.weight, 0);
      let dr = Math.random() * dtTotal, chosenDrop = DROP_TABLE[0];
      for (const d of DROP_TABLE) { dr -= d.weight; if (dr <= 0) { chosenDrop = d; break; } }
      const dropResult = await chosenDrop.fn();
      addXP(userId, 75); checkAndAwardAchievements(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Landed!").setDescription(`The drop landed in **${location}** — you reached it first!\n\nInside the crate:\n\n${dropResult}!\n\n+75 XP earned!`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setFooter({ text: "Next supply drop in 30 minutes" }).setTimestamp()] });
    },
  },

  // ── /build ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("build").setDescription("Build a structure for protection — each material blocks a set number of attacks").addStringOption((o) => o.setName("material").setDescription("Building material").setRequired(true).addChoices({ name: "🪵 Wood — 50 V-Bucks (1 hit)", value: "wood" }, { name: "🧱 Brick — 125 V-Bucks (2 hits)", value: "brick" }, { name: "⚙️ Metal — 250 V-Bucks (3 hits)", value: "metal" })),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const material = interaction.options.getString("material");
      const mat = BUILD_MATS[material];
      const user = getUser(userId);
      if (!user.infiniteVbucks && user.vbucks < mat.cost) {
        await interaction.reply({ content: `❌ Need **${mat.cost} V-Bucks** to build with **${mat.label}**. You have **${user.vbucks.toLocaleString()}**.` }); return;
      }
      if (!user.infiniteVbucks) addVbucks(userId, -mat.cost);
      updateUser(userId, { buildCharges: mat.charges, buildMaterial: material, timesBuilt: (user.timesBuilt ?? 0) + 1 });
      addXP(userId, 30); checkAndAwardAchievements(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Structure Built — ${mat.label}!`).setDescription(`You built a **${mat.label}** structure!\n\n${mat.desc}\n\n> Each incoming hit will consume 1 charge before dealing damage.\n> When charges run out, the structure collapses.\n\n💳 **V-Bucks spent:** ${mat.cost.toLocaleString()}\n🏗️ **Charges:** ${mat.charges}`).setColor(material === "wood" ? 0x8b4513 : material === "brick" ? 0xb05020 : 0x708090).setFooter({ text: "Build charges persist until consumed" }).setTimestamp()] });
    },
  },

  // ── /medkit ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("medkit").setDescription("Use a medkit to cut your elimination time in half (costs 100 V-Bucks)"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!isEliminated(userId)) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ You're Not Eliminated!").setDescription("You don't need a medkit — you're alive!\n\nUse one when you're eliminated by another player.").setColor(0x00ff00).setTimestamp()] }); return; }
      const cost = 100;
      if (!user.infiniteVbucks && user.vbucks < cost) { await interaction.reply({ content: `❌ Need **${cost} V-Bucks** for a medkit. You have **${user.vbucks.toLocaleString()}**.` }); return; }
      const timeLeft = getEliminationTimeLeft(userId);
      const newTime = Math.floor(timeLeft / 2);
      const newElimUntil = Date.now() + newTime;
      if (!user.infiniteVbucks) addVbucks(userId, -cost);
      updateUser(userId, { eliminatedUntil: newElimUntil });
      addXP(userId, 25);
      const minsLeft = Math.ceil(newTime / 60000);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💊 Medkit Used!").setDescription(`You used a **medkit**! Your elimination time was cut in half.\n\n⏳ **Time remaining:** ${minsLeft} minute${minsLeft !== 1 ? "s" : ""}\n💳 **V-Bucks spent:** ${cost}\n\n*Ask someone to \`/reboot\` you to clear it entirely!*`).setColor(0x2ecc71).setFooter({ text: "Self-heal in action" }).setTimestamp()] });
    },
  },

  // ── /spy ─────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("spy").setDescription("Spy on another player to see their public bot stats").addUserOption((o) => o.setName("player").setDescription("Player to spy on").setRequired(true)),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.reply({ content: "❌ Can't spy on a bot — they have no stats." }); return; }
      const targetData = getUser(target.id);
      const tier = getBattlePassTier(targetData.level, targetData.xp);
      const eliminated = isEliminated(target.id);
      const timeLeft = eliminated ? Math.ceil(getEliminationTimeLeft(target.id) / 60000) : 0;
      const matInfo = targetData.buildCharges > 0 ? `${BUILD_MATS[targetData.buildMaterial]?.label ?? "🪵 Wood"} (${targetData.buildCharges} charge${targetData.buildCharges !== 1 ? "s" : ""})` : "None";
      const vbDisplay = targetData.infiniteVbucks ? "∞ (Infinite!)" : `~${Math.floor(targetData.vbucks / 500) * 500}+`; // Approximate V-Bucks, not exact
      const spyActions = ["hacked a satellite dish", "bribed a llama", "intercepted their signals", "found their trophy case", "checked their Fortnite locker"];
      const spyFlavor = spyActions[Math.floor(Math.random() * spyActions.length)];
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🕵️ Intel Report — ${target.username}`).setDescription(`*You ${spyFlavor} and uncovered the following intelligence:*\n\n📊 **Level:** ${targetData.level}\n🎮 **Battle Pass Tier:** ${tier}/100\n🎒 **Skins:** ${targetData.inventory.length}\n💰 **V-Bucks (approx):** ${vbDisplay}\n🔥 **Daily Streak:** ${targetData.dailyStreak ?? 0} days\n🏗️ **Build:** ${matInfo}\n🪙 **Coin Flip W/L:** ${targetData.coinflipsWon ?? 0} wins\n${eliminated ? `\n☠️ **Status:** ELIMINATED (${timeLeft} min left)` : "\n✅ **Status:** Active in game"}\n\n*Stats may be incomplete due to encryption.*`).setColor(0x2c2c2c).setThumbnail(target.displayAvatarURL()).setFooter({ text: `Spy report • ${interaction.user.username}` }).setTimestamp()] });
    },
  },

  // ── /duel ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("duel").setDescription("Challenge someone to a 1v1 skin or V-Bucks duel!").addUserOption((o) => o.setName("player").setDescription("Player to duel").setRequired(true)).addStringOption((o) => o.setName("wager").setDescription("What to wager").setRequired(false).addChoices({ name: "💰 V-Bucks (500)", value: "vbucks" }, { name: "🎮 A Skin from inventory", value: "skin" })),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const wagerType = interaction.options.getString("wager") ?? "vbucks";
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't duel yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't duel bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId), targetData = getUser(target.id);
      updateUser(userId, { duelsPlayed: (challenger.duelsPlayed ?? 0) + 1 });
      if (wagerType === "vbucks") {
        const amount = 500;
        if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.editReply({ content: `❌ Need **${amount} V-Bucks** to duel.` }); return; }
        if (!targetData.infiniteVbucks && targetData.vbucks < amount) { await interaction.editReply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
        const embed = new EmbedBuilder().setTitle("⚔️ Duel Challenge!").setDescription(`<@${userId}> challenged <@${target.id}> to a **1v1 duel!**\n\n💰 **Wager:** 500 V-Bucks each\n🏆 **Winner takes:** 1,000 V-Bucks\n\n<@${target.id}>, do you accept?`).setColor(0xff4444).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_accept_${userId}`).setLabel("⚔️ Accept").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`duel_decline_${userId}`).setLabel("🏳️ Decline").setStyle(ButtonStyle.Secondary));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id });
        collector.on("collect", async (btn) => {
          if (btn.customId.includes("decline")) { await btn.update({ embeds: [new EmbedBuilder().setTitle("🏳️ Duel Declined").setDescription(`<@${target.id}> backed down!`).setColor(0x888888).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
          collector.stop("accepted");
          await btn.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Duel in Progress!").setDescription("```\nCountdown: 3...\n2...\n1...\nFIRE!\n```").setColor(0xff4444).setTimestamp()], components: [] });
          await new Promise((r) => setTimeout(r, 2500));
          const cLuck = LUCK_BOOST[challenger.activeLuck] ?? 0, tLuck = LUCK_BOOST[targetData.activeLuck] ?? 0;
          const cScore = Math.random() * 100 + cLuck, tScore = Math.random() * 100 + tLuck;
          const winnerId = cScore > tScore ? userId : target.id, loserId = winnerId === userId ? target.id : userId;
          if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
          addVbucks(winnerId, amount); addXP(winnerId, 150);
          awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
          const winner = getUser(winnerId), loser = getUser(loserId);
          const moves = ["landed a perfect headshot", "built a 90 and edited out", "pump-sniped from 200m", "hit every shot with the Stinger", "RNG blessed them"];
          const move = moves[Math.floor(Math.random() * moves.length)];
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Duel Over — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** ${move} and eliminated **<@${loserId}>**!\n\n🏆 **+${amount} V-Bucks** to the winner!\n💸 **-${amount} V-Bucks** from the loser\n\n${cLuck !== tLuck ? `> Luck difference: ${cLuck > tLuck ? `<@${userId}> had +${cLuck}% luck advantage` : `<@${target.id}> had +${tLuck}% luck advantage`}` : ""}`).setColor(0xffd700).setTimestamp()], content: "" });
        });
        collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      } else {
        // Skin duel
        const challSkins = Object.entries(challenger.inventoryNames), targSkins = Object.entries(targetData.inventoryNames);
        if (!challSkins.length) { await interaction.editReply({ content: "❌ You have no skins to wager." }); return; }
        if (!targSkins.length) { await interaction.editReply({ content: `❌ <@${target.id}> has no skins to wager.` }); return; }
        const challOpts = challSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> challenged <@${target.id}> to a **skin duel**!\n\n<@${userId}>, pick a skin to wager first.`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_challenger").setPlaceholder("Pick your skin...").addOptions(challOpts))] });
        let challPick = null, targPick = null;
        const collector2 = msg.createMessageComponentCollector({ time: 2 * 60 * 1000, filter: (i) => i.user.id === userId || i.user.id === target.id });
        collector2.on("collect", async (i) => {
          if (i.isStringSelectMenu() && i.customId === "duel_skin_challenger" && i.user.id === userId) {
            challPick = { key: i.values[0], name: challenger.inventoryNames[i.values[0]] };
            const targOpts = targSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> wagers **${challPick.name}**!\n\n<@${target.id}>, pick your skin to wager:`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_target").setPlaceholder("Pick your skin...").addOptions(targOpts))] }); return;
          }
          if (i.isStringSelectMenu() && i.customId === "duel_skin_target" && i.user.id === target.id) {
            targPick = { key: i.values[0], name: targetData.inventoryNames[i.values[0]] };
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`**<@${userId}>** wagers **${challPick.name}**\n**<@${target.id}>** wagers **${targPick.name}**\n\n*The duel begins...*`).setColor(0xff0000).setTimestamp()], components: [] });
            await new Promise((r) => setTimeout(r, 2500));
            const cLuck = LUCK_BOOST[challenger.activeLuck] ?? 0, tLuck = LUCK_BOOST[targetData.activeLuck] ?? 0;
            const cScore = Math.random() * 100 + cLuck, tScore = Math.random() * 100 + tLuck;
            const [winnerId, loserId, winnerPick, loserPick] = cScore > tScore ? [userId, target.id, targPick, challPick] : [target.id, userId, challPick, targPick];
            const winnerData = getUser(winnerId), loserData = getUser(loserId);
            const idx = loserData.inventory.indexOf(loserPick.key.replace(/_\d+$/, "")); if (idx !== -1) loserData.inventory.splice(idx, 1); delete loserData.inventoryNames[loserPick.key];
            addSkinToInventory(winnerId, loserPick.key.replace(/_\d+$/, ""), loserPick.name);
            awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Skin Duel — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** outplayed **<@${loserId}>**!\n\n🏆 **<@${winnerId}>** receives **${loserPick.name}**!\n\n*Check \`/inventory\` to see your new skin.*`).setColor(0xffd700).setTimestamp()], content: "" });
            collector2.stop("done");
          }
        });
        collector2.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      }
    },
  },
];

// ─────────────────────────────────────────────
//  Command registration + Discord client
// ─────────────────────────────────────────────
const commandMap = new Map(commands.map((c) => [c.data.name, c]));

async function registerCommands(token, clientId) {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const body = commands.map((c) => c.data.toJSON());

    // Multi-guild support
    const guildIdsRaw = process.env.GUILD_IDS;

    if (guildIdsRaw) {
      const guildIds = guildIdsRaw
        .split(",")
        .map(id => id.trim())
        .filter(Boolean);

      // Clear + register each guild
      for (const guildId of guildIds) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: [] }
        );

        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body }
        );

        console.log(`✅ Registered ${body.length} commands for guild ${guildId}`);
      }
    } else {
      // Global fallback
      await rest.put(
        Routes.applicationCommands(clientId),
        { body }
      );

      console.log(`✅ Registered ${body.length} global commands`);
    }
  } catch (err) {
    console.error("❌ Registration failed:", err);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID || client.user.id;
  const guildId = process.env.DISCORD_GUILD_ID;
  await registerCommands(token, clientId, guildId);
  try { await fetchFortniteSkins(); console.log("✅ Fortnite skins loaded"); } catch (err) { console.warn("⚠️ Could not pre-load skins:", err.message); }
  initSpawner(client);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) { const cmd = commandMap.get(interaction.commandName); if (cmd?.autocomplete) await cmd.autocomplete(interaction); return; }
    if (!interaction.isChatInputCommand()) return;
    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) return;
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Command error [${interaction.commandName}]:`, err);
    const msg = { content: "❌ Something went wrong!", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() === "buy") await handleBuyMessage(message).catch(console.error);
});

client.on("error", (err) => console.error("Discord client error:", err));

const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (token) client.login(token).catch((err) => console.error("❌ Discord login failed:", err.message));
else console.warn("⚠️ No DISCORD_TOKEN — Express server running but bot is offline.");

process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
