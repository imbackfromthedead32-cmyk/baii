require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
} = require("discord.js");

const express = require("express");

// ─────────────────────────────────────────────
//  Express health server (Railway compatible)
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());
const rewards = {};
app.get("/check", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.post("/give", (req, res) => {
  const { userId, item, amount } = req.body;
  if (!userId || !item) return res.status(400).json({ error: "userId and item required" });
  if (!rewards[userId]) rewards[userId] = {};
  rewards[userId][item] = (rewards[userId][item] || 0) + (amount || 1);
  res.json({ success: true, rewards: rewards[userId] });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server on port ${PORT}`));

// ─────────────────────────────────────────────
//  In-memory storage
// ─────────────────────────────────────────────
const DAILY_QUESTS = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",              xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                    xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",               xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",         xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip",   xpReward: 150, required: 1 },
];

function freshQuests() {
  return DAILY_QUESTS.map((q) => ({ ...q, current: 0, completed: false }));
}

const _data = {
  config: { guildSpawnChannels: {} },
  users: {},
  itemShop: { skins: [], lastReset: 0 },
  coinflipChallenges: {},
};

function getUser(userId) {
  if (!_data.users[userId]) {
    _data.users[userId] = {
      vbucks: 500,
      inventory: [],
      inventoryNames: {},
      xp: 0,
      level: 1,
      interactionCount: 0,
      boxes: 0,
      quests: freshQuests(),
      lastQuestReset: Date.now(),
      lastDailyClaim: 0,
      dailyStreak: 0,
      achievementsEarned: [],
      coinflipsWon: 0,
      boxesOpened: 0,
      giftsGiven: 0,
      tradesCompleted: 0,
      shopPurchases: 0,
      shopSkins: [],
      shopSkinPrices: {},
      brokeAttempt: false,
      refundCooldowns: {},
      hasCreatorCode: false,
      creatorDiscount: 0,
      hasFoundersPack: false,
      foundersBoxes: 0,
      foundersBoxesOpened: 0,
      freeSkinExpiry: 0,
      freeSkinRedeemed: false,
      freeSkinIds: [],
      eliminatedUntil: 0,
      weapons: [],
      zeroPointUseTimes: [],
      zeroPointCrackedUntil: 0,
      // New fields
      luckPotion: 0,
      xtraLuckPotion: 0,
      godlyLuckPotion: 0,
      activeLuck: "none",
      infiniteVbucks: false,
      godChest: 0,
      mysteriousChest: 0,
      foundersQuestPending: [],
    };
  }
  const u = _data.users[userId];
  if (!u.achievementsEarned) u.achievementsEarned = [];
  if (!u.shopSkins) u.shopSkins = [];
  if (!u.shopSkinPrices) u.shopSkinPrices = {};
  if (!u.refundCooldowns) u.refundCooldowns = {};
  if (!u.weapons) u.weapons = [];
  if (!u.zeroPointUseTimes) u.zeroPointUseTimes = [];
  if (u.zeroPointCrackedUntil === undefined) u.zeroPointCrackedUntil = 0;
  if (u.luckPotion === undefined) u.luckPotion = 0;
  if (u.xtraLuckPotion === undefined) u.xtraLuckPotion = 0;
  if (u.godlyLuckPotion === undefined) u.godlyLuckPotion = 0;
  if (u.activeLuck === undefined) u.activeLuck = "none";
  if (u.infiniteVbucks === undefined) u.infiniteVbucks = false;
  if (u.godChest === undefined) u.godChest = 0;
  if (u.mysteriousChest === undefined) u.mysteriousChest = 0;
  if (!u.foundersQuestPending) u.foundersQuestPending = [];
  if (!u.freeSkinIds) u.freeSkinIds = [];
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
  const gainedVbucks = user.interactionCount % 30 === 0;
  if (gainedVbucks && !user.infiniteVbucks) user.vbucks += 250;
  return { gainedVbucks };
}

function addVbucks(userId, amount) {
  const user = getUser(userId);
  if (user.infiniteVbucks && amount < 0) return;
  user.vbucks = user.vbucks + amount;
}

function addSkinToInventory(userId, skinId, skinName) {
  const user = getUser(userId);
  user.inventory.push(skinId);
  user.inventoryNames[skinId + "_" + user.inventory.length] = skinName;
}

function xpForLevel(level) { return Math.min(100 * level, 450); }

function calculateLevelFromXP(totalXp) {
  let level = 1, remaining = totalXp;
  while (true) {
    const needed = xpForLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpForNext: needed };
    remaining -= needed;
    level++;
  }
}

function addXP(userId, amount) {
  const user = getUser(userId);
  const before = calculateLevelFromXP(user.xp);
  user.xp += amount;
  const after = calculateLevelFromXP(user.xp);
  const leveledUp = after.level > before.level;
  user.level = after.level;
  if (leveledUp) user.boxes += after.level - before.level;
  return { leveledUp, newLevel: after.level };
}

function resetQuestsIfNeeded(userId) {
  const user = getUser(userId);
  if (Date.now() - user.lastQuestReset > 24 * 60 * 60 * 1000) {
    user.quests = freshQuests();
    user.lastQuestReset = Date.now();
  }
}

function progressQuest(userId, questId, amount = 1) {
  resetQuestsIfNeeded(userId);
  const user = getUser(userId);
  const quest = user.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;
  quest.current = Math.min(quest.current + amount, quest.required);
  if (quest.current >= quest.required) {
    quest.completed = true;
    addXP(userId, quest.xpReward);
    user.foundersBoxes = (user.foundersBoxes ?? 0) + 1;
  }
  return quest.completed ? quest : null;
}

function isEliminated(userId) {
  return (getUser(userId).eliminatedUntil ?? 0) > Date.now();
}
function getEliminationTimeLeft(userId) {
  return Math.max(0, (getUser(userId).eliminatedUntil ?? 0) - Date.now());
}
function hasActiveFreeSkin(userId) {
  const u = getUser(userId);
  return (u.freeSkinExpiry ?? 0) > Date.now() && !(u.freeSkinRedeemed ?? false);
}
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
  { id: "first_catch",    title: "First Catch",            emoji: "🎮", description: "Catch your first spawned skin",                check: (u) => u.inventory.length >= 1 },
  { id: "collector",      title: "Collector",              emoji: "🎒", description: "Catch or own 10 skins",                       check: (u) => u.inventory.length >= 10 },
  { id: "hoarder",        title: "Hoarder",                emoji: "📦", description: "Catch or own 50 skins",                       check: (u) => u.inventory.length >= 50 },
  { id: "shop_regular",   title: "Shop Regular",           emoji: "🛒", description: "Buy a skin from the Item Shop",               check: (u) => (u.shopPurchases ?? 0) >= 1 },
  { id: "big_spender",    title: "Big Spender",            emoji: "💸", description: "Buy 5 skins from the Item Shop",              check: (u) => (u.shopPurchases ?? 0) >= 5 },
  { id: "generous",       title: "Generous",               emoji: "🎁", description: "Gift a skin to another player",               check: (u) => (u.giftsGiven ?? 0) >= 1 },
  { id: "trader",         title: "Trader",                 emoji: "🔄", description: "Complete a skin trade",                       check: (u) => (u.tradesCompleted ?? 0) >= 1 },
  { id: "lucky_flip",     title: "Lucky Flip",             emoji: "🪙", description: "Win a coin flip",                             check: (u) => (u.coinflipsWon ?? 0) >= 1 },
  { id: "flip_master",    title: "Flip Master",            emoji: "🎰", description: "Win 10 coin flips",                           check: (u) => (u.coinflipsWon ?? 0) >= 10 },
  { id: "box_opener",     title: "Box Opener",             emoji: "📬", description: "Open a Save the World Box",                   check: (u) => (u.boxesOpened ?? 0) >= 1 },
  { id: "stw_devotee",    title: "STW Devotee",            emoji: "⚡", description: "Open 10 Save the World Boxes",               check: (u) => (u.boxesOpened ?? 0) >= 10 },
  { id: "streak_starter", title: "Streak Starter",         emoji: "🔥", description: "Reach a 3-day daily streak",                  check: (u) => (u.dailyStreak ?? 0) >= 3 },
  { id: "on_fire",        title: "On Fire",                emoji: "🌋", description: "Reach a 7-day daily streak",                  check: (u) => (u.dailyStreak ?? 0) >= 7 },
  { id: "unstoppable",    title: "Unstoppable",            emoji: "👑", description: "Reach a 30-day daily streak",                 check: (u) => (u.dailyStreak ?? 0) >= 30 },
  { id: "level_5",        title: "Rising Star",            emoji: "⭐", description: "Reach Level 5",                              check: (u) => u.level >= 5 },
  { id: "level_10",       title: "Veteran",                emoji: "🌟", description: "Reach Level 10",                             check: (u) => u.level >= 10 },
  { id: "level_25",       title: "Legend",                 emoji: "💫", description: "Reach Level 25",                             check: (u) => u.level >= 25 },
  { id: "wealthy",        title: "Wealthy",                emoji: "💰", description: "Hold 5,000 V-Bucks at once",                  check: (u) => u.vbucks >= 5000 },
  { id: "rich",           title: "Rich",                   emoji: "💎", description: "Hold 10,000 V-Bucks at once",                 check: (u) => u.vbucks >= 10000 },
  { id: "daily_player",   title: "Daily Player",           emoji: "📅", description: "Claim daily reward 7 days in a row",          check: (u) => (u.dailyStreak ?? 0) >= 7 },
  { id: "broke",          title: "Broke",                  emoji: "🪙", description: "Tried to buy a skin you can't afford",        check: (u) => u.brokeAttempt === true },
  { id: "scammed",        title: "Scammed",                emoji: "🤡", description: "Fell for a free vbucks scam",                 check: () => false },
  { id: "epic_likes_you", title: "Epic Games Likes You",   emoji: "💚", description: "Get a refund approved by Epic Games",         check: () => false },
  { id: "epic_hates_you", title: "Epic Games Doesn't Like You", emoji: "💔", description: "Get a refund rejected by Epic Games",   check: () => false },
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
  return new EmbedBuilder()
    .setTitle(`${ach.emoji} Achievement Unlocked!`)
    .setDescription(`**${ach.title}**\n*${ach.description}*`)
    .setColor(0xf4a01a).setTimestamp();
}

// ─────────────────────────────────────────────
//  Fortnite data
// ─────────────────────────────────────────────
const FORTNITE_WEAPONS = [
  { id: "pump_shotgun",     name: "Pump Shotgun",            description: "One pump — if it lands.",             emoji: "🔫", type: "shotgun"   },
  { id: "heavy_sniper",     name: "Heavy Sniper Rifle",       description: "Walls? What walls?",                 emoji: "🎯", type: "sniper"    },
  { id: "scar",             name: "SCAR",                     description: "The gold standard of ARs.",           emoji: "⚡", type: "ar"        },
  { id: "rocket_launcher",  name: "Rocket Launcher",          description: "Shoot first, aim never.",             emoji: "🚀", type: "explosive" },
  { id: "bolt_sniper",      name: "Bolt-Action Sniper Rifle", description: "Patience is a virtue.",               emoji: "🎯", type: "sniper"    },
  { id: "hand_cannon",      name: "Hand Cannon",              description: "A pistol with stopping power.",       emoji: "🔫", type: "pistol"    },
  { id: "combat_shotgun",   name: "Combat Shotgun",           description: "Fast fire, no mercy.",                emoji: "💥", type: "shotgun"   },
  { id: "grenade_launcher", name: "Grenade Launcher",         description: "Indirect fire specialist.",           emoji: "💣", type: "explosive" },
  { id: "stinger_smg",      name: "Stinger SMG",              description: "Up close and very personal.",         emoji: "⚡", type: "smg"       },
  { id: "thermal_scoped",   name: "Thermal Scoped AR",        description: "Nobody hides from this.",             emoji: "🔭", type: "ar"        },
  { id: "rapid_fire_smg",   name: "Rapid Fire SMG",           description: "Half the accuracy, twice the panic.", emoji: "💨", type: "smg"       },
  { id: "mythic_goldfish",  name: "Mythic Goldfish",           description: "It's a fish. A very powerful fish.", emoji: "🐟", type: "special"   },
];
const MULTI_AMMO_TYPES = new Set(["smg", "ar"]);
function isMultiAmmoWeapon(w) { return MULTI_AMMO_TYPES.has(w.type); }
function getWeaponByName(name) {
  const q = name.toLowerCase().trim();
  return FORTNITE_WEAPONS.find((w) => w.name.toLowerCase() === q || w.id === q || w.name.toLowerCase().includes(q));
}

const RARITY_WEIGHTS = { legendary: 5, epic: 10, rare: 20, uncommon: 30, common: 35 };
let cachedSkins = [];
let cachedStwSkins = [];

const STW_KEYWORDS = ["robo","kevin","save the world","constructor","ninja","outlander","soldier","commando","striker","ramirez","headhunter","jonesy","penny","dim mak","brawler","dragon","powerhouse","hazard","renegade","urban assault","special forces"];
const KNOWN_STW_IDS = ["CID_028_Athena_Commando_F","CID_029_Athena_Commando_F_Halloween","CID_017_Athena_Commando_M","CID_040_Athena_Commando_M_NinjaBlue"];

async function fetchFortniteSkins() {
  if (cachedSkins.length > 0) return cachedSkins;
  try {
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br", { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json();
    cachedSkins = json.data.filter((s) => {
      if (s.type?.value !== "outfit") return false;
      const name = s.name?.trim();
      if (!name || name === "null" || name === "TBD") return false;
      if (name.toLowerCase().startsWith("tid_")) return false;
      const img = s.images?.featured || s.images?.icon || s.images?.small;
      return img && img.trim() !== "" && img !== "null";
    }).map((s) => {
      const nameLower = s.name.toLowerCase();
      const descLower = (s.description ?? "").toLowerCase();
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
  const skins = await fetchFortniteSkins();
  const q = query.trim().toLowerCase();
  const exact = skins.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = skins.filter((s) => s.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return partial.find((s) => s.name.toLowerCase().startsWith(q)) ?? partial[0];
  return null;
}

function getRarityColor(rarity) {
  const colors = { legendary: 0xf4a01a, epic: 0x9b4dca, rare: 0x0075e3, uncommon: 0x1a9b1a, common: 0x808080, marvel: 0xed1d24, dc: 0x0074e8, icon: 0x00d4ff, shadow: 0x2c2c2c, slurp: 0x00e5ff, frozen: 0xa8d8ea, lava: 0xff4500, dark: 0x6a0dad };
  return colors[rarity.toLowerCase()] ?? 0x808080;
}
function getRarityEmoji(rarity) {
  const emojis = { legendary: "🟡", epic: "🟣", rare: "🔵", uncommon: "🟢", common: "⚪", marvel: "🔴", dc: "🔵", icon: "🩵", shadow: "🖤", dark: "🟤" };
  return emojis[rarity.toLowerCase()] ?? "⚪";
}
function getSpawnPercent(rarity) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  return (((RARITY_WEIGHTS[rarity.toLowerCase()] ?? 15) / total) * 100).toFixed(1);
}

// ─────────────────────────────────────────────
//  Shop
// ─────────────────────────────────────────────
const SHOP_RESET_MS = 24 * 60 * 60 * 1000;
const SKIN_PRICE = 1500;

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
//  Spawn system
// ─────────────────────────────────────────────
const VBUCKS_IMAGE = "https://fortnite-api.com/images/vbuck.png";
const FOUNDERS_PACK_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/4/4d/Founders_Pack_-_Icon.png";
const FOUNDERS_BOX_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/9/98/Llama-_Standard.png";
const STW_LOGO_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/a/a3/Save_the_World_-_Logo.png";
const LUCK_POTION_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/f/f2/Slurp_Juice_-_Consumable_-_Fortnite.png";

const activeSpawns = {};
const spawnTimers = {};
let botClient = null;
const MIN_SPAWN_MS = 3 * 60 * 1000, MAX_SPAWN_MS = 5 * 60 * 1000;

function getNextSpawnDelay() { return MIN_SPAWN_MS + Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS); }
function getActiveSpawn(guildId) { return activeSpawns[guildId] ?? null; }

function scheduleNextSpawn(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  if (activeSpawns[guildId]) return;
  const delay = getNextSpawnDelay();
  spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), delay);
}

async function spawnRandom(client, guildId, channelId) {
  const roll2 = Math.random();
  if (roll2 < 1/35) await spawnStwPacks(client, guildId, channelId);
  else if (roll2 < 2/35) await spawnLuckPotion(client, guildId, channelId);
  else await spawnSkin(client, guildId, channelId);
}

async function spawnSkin(client, guildId, channelId, forced = false, specificSkin) {
  if (activeSpawns[guildId] && !forced) return false;
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
  if (activeSpawns[guildId] && !forced) return false;
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const embed = new EmbedBuilder().setTitle("💰 V-Bucks Drop!").setDescription("A bag of **1,000 V-Bucks** has appeared!\n\nType `buy` to grab them!").setColor(0x00d4ff).setImage(VBUCKS_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "vbucks", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnStwPacks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId] && !forced) return false;
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const embed = new EmbedBuilder().setTitle("⚡ Save the World Pack Drop!").setDescription("**5 Save the World Packs** have appeared!\n\nType `buy` to claim all 5 boxes!").setColor(0xff6600).setImage(STW_LOGO_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "stw_packs", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnFoundersPack(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId] && !forced) return false;
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const embed = new EmbedBuilder().setTitle("🌟 Founders Pack Has Spawned!").setDescription("A rare **Founders Pack** has appeared!\n\nClaim this to unlock Founders Boxes for V-Bucks rewards!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FOUNDERS_PACK_IMAGE).setFooter({ text: "Very rare!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "founders_pack", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnFoundersBox(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId] && !forced) return false;
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const embed = new EmbedBuilder().setTitle("📦 Founders Box Has Spawned!").setDescription("A **Founders Box** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FOUNDERS_BOX_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "founders_box", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnLuckPotion(client, guildId, channelId, forced = false, type = "luckPotion") {
  if (activeSpawns[guildId] && !forced) return false;
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion" };
  const label = labels[type] || labels.luckPotion;
  const realType = labels[type] ? type : "luckPotion";
  try {
    const embed = new EmbedBuilder().setTitle(`${label} Spawned!`).setDescription(`A **${label}** has appeared!\n\nBoosts your luck on chests and rewards!\nType \`buy\` to claim!`).setColor(0x2ecc71).setImage(LUCK_POTION_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
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
    const minsLeft = Math.ceil(getEliminationTimeLeft(userId) / 60000);
    await message.channel.send({ content: `<@${userId}> ☠️ You've been eliminated! You can't catch anything for **${minsLeft} minute${minsLeft !== 1 ? "s" : ""}**. Ask someone to \`/reboot\` you!` });
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
  let embed;
  if (spawn.type === "vbucks") {
    addVbucks(userId, 1000);
    const newAch = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> grabbed **1,000 V-Bucks**! 💰\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (newAch.length) desc += `\n\n🏆 **Achievement Unlocked!** ${newAch.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`💰 ${message.author.username} grabbed the V-Bucks!`).setDescription(desc).setColor(0x00d4ff).setTimestamp();
  } else if (spawn.type === "stw_packs") {
    const user = getUser(userId); updateUser(userId, { boxes: user.boxes + 5 });
    const newAch = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> claimed **5 STW Packs**! Open them with \`/savetheworld\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (newAch.length) desc += `\n\n🏆 **Achievement Unlocked!** ${newAch.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed STW Packs!`).setDescription(desc).setColor(0xff6600).setTimestamp();
  } else if (spawn.type === "founders_pack") {
    updateUser(userId, { hasFoundersPack: true });
    const newAch = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> claimed the **Founders Pack**! 🌟\n\nOpen Founders Boxes with \`/founderpack\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (newAch.length) desc += `\n\n🏆 **Achievement Unlocked!** ${newAch.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🌟 ${message.author.username} claimed the Founders Pack!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "founders_box") {
    const user = getUser(userId); updateUser(userId, { foundersBoxes: (user.foundersBoxes ?? 0) + 1 });
    const newAch = checkAndAwardAchievements(userId);
    const msg2 = user.hasFoundersPack ? "Open it with `/founderpack`!" : "Get a Founders Pack to open it!";
    let desc = `<@${userId}> claimed a **Founders Box**! 📦\n\n${msg2}\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (newAch.length) desc += `\n\n🏆 **Achievement Unlocked!** ${newAch.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed a Founders Box!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "luckPotion" || spawn.type === "xtraLuckPotion") {
    const user = getUser(userId);
    const field = spawn.type;
    updateUser(userId, { [field]: (user[field] ?? 0) + 1 });
    const label = spawn.type === "luckPotion" ? "🍀 Luck Potion" : "🔮 Xtra Luck Potion";
    let desc = `<@${userId}> grabbed a **${label}**! Use it with \`/useluckpotion\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`✨ ${message.author.username} claimed a ${label}!`).setDescription(desc).setColor(0x2ecc71).setTimestamp();
  } else if (spawn.type === "skin" && spawn.skin) {
    addSkinToInventory(userId, spawn.skin.id, spawn.skin.name);
    progressQuest(userId, "catch_skins");
    const newAch = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> snagged **${spawn.skin.name}**!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (newAch.length) desc += `\n\n🏆 **Achievement Unlocked!** ${newAch.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🏆 ${message.author.username} caught ${spawn.skin.name}!`).setDescription(desc).setColor(getRarityColor(spawn.skin.rarity)).setThumbnail(spawn.skin.imageUrl).setTimestamp();
  } else return;
  await message.channel.send({ embeds: [embed] });
  if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
}

function initSpawner(client) {
  botClient = client;
  for (const [guildId, channelId] of Object.entries(getAllGuildSpawnChannels())) {
    if (!channelId) continue;
    const delay = getNextSpawnDelay();
    spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), delay);
  }
}

function restartSpawner(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  delete activeSpawns[guildId];
  scheduleNextSpawn(client, guildId, channelId);
}

// ─────────────────────────────────────────────
//  God Chest / Mysterious Chest mechanics
// ─────────────────────────────────────────────
async function openGodChest(interaction, player) {
  if (player.godChest <= 0) return interaction.reply({ content: "❌ You have no God Chests!", ephemeral: true });
  player.godChest--;
  const luck = player.activeLuck;
  const mystChance = boostedChance(25, luck);
  const vbChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < mystChance) {
    player.mysteriousChest++;
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_mysterious_${interaction.user.id}`).setLabel("🔵 Open Mysterious Chest").setStyle(ButtonStyle.Primary));
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("🔵 Mysterious Chest!").setDescription("A **BLUE MYSTERIOUS CHEST** pulsing with unknown energy appeared from the God Chest!\n\nOpen it to reveal its contents!").setFooter({ text: "Click Open to reveal!" });
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const col = reply.createMessageComponentCollector({ time: 60000 });
    col.on("collect", async (btn) => {
      if (btn.user.id !== interaction.user.id) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
      await openMysteriousChest(btn, player);
      col.stop();
    });
  } else if (rng < mystChance + vbChance) {
    addVbucks(interaction.user.id, 1000);
    const updated = getUser(interaction.user.id);
    const embed = new EmbedBuilder().setColor("#FFD700").setTitle("🌟 God Chest — 1,000 V-Bucks!").setDescription(`You received **1,000 V-Bucks** from the God Chest!\nTotal: **${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks**`);
    await interaction.reply({ embeds: [embed] });
  } else {
    const embed = new EmbedBuilder().setColor("#607d8b").setTitle("🌟 God Chest — Empty").setDescription("The God Chest glimmered... but was hollow inside.\n\nBetter luck next time!").setFooter({ text: `Mysterious: ${mystChance}% | 1k VBucks: ${vbChance}% | Nothing: rest` });
    await interaction.reply({ embeds: [embed] });
  }
}

async function openMysteriousChest(interaction, player) {
  if (player.mysteriousChest <= 0) return interaction.reply({ content: "❌ You have no Mysterious Chests!", ephemeral: true });
  player.mysteriousChest--;
  const luck = player.activeLuck;
  const infChance = boostedChance(15, luck);
  const tenKChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < infChance) {
    player.infiniteVbucks = true;
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — INFINITE V-BUCKS!").setDescription("✨ **INFINITE V-BUCKS!** ✨\nYour V-Bucks will **never go down** again. You have unlocked **∞ V-Bucks**!").setFooter({ text: "Mysterious Chest" });
    await interaction.reply({ embeds: [embed] });
  } else if (rng < infChance + tenKChance) {
    addVbucks(interaction.user.id, 10000);
    const updated = getUser(interaction.user.id);
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 10,000 V-Bucks!").setDescription(`You received **10,000 V-Bucks** from the Mysterious Chest!\nTotal: **${updated.vbucks.toLocaleString()} V-Bucks**`);
    await interaction.reply({ embeds: [embed] });
  } else {
    addVbucks(interaction.user.id, 1000);
    const updated = getUser(interaction.user.id);
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 1,000 V-Bucks").setDescription(`You received **1,000 V-Bucks** from the Mysterious Chest!\nTotal: **${updated.vbucks.toLocaleString()} V-Bucks**`);
    await interaction.reply({ embeds: [embed] });
  }
}

// ─────────────────────────────────────────────
//  Slash commands definitions
// ─────────────────────────────────────────────
const VALID_CODES = {
  tylajadee: { displayName: "Tylajadee", discount: 0.1, freeSkin: true },
  qckdream:  { displayName: "Qckdream",  discount: 0.1 },
  clovel:    { displayName: "Clovel",    discount: 0.2 },
};

const FOUNDERS_QUESTS_POOL = [
  "Eliminate 5 Husks","Collect 20 Wood","Build 3 structures","Open 2 chests in the world",
  "Survive 1 storm","Collect 10 metal","Help 1 survivor","Explore a new zone",
  "Complete a mini-mission","Find 5 hidden items",
];
function pickRandom(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }

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

const commands = [
  // ── /setup ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("setup").setDescription("Set the channel where Fortnite skins will spawn").addChannelOption((o) => o.setName("channel").setDescription("Text channel for spawns").addChannelTypes(ChannelType.GuildText).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel", true);
      setSpawnChannel(guildId, channel.id);
      const embed = new EmbedBuilder().setTitle("✅ Bot Setup Complete!").setDescription(`Skins will spawn in <#${channel.id}>!\n\nFirst skin appears shortly, then every **3–5 minutes**.\n\nType \`buy\` to catch spawns!`).setColor(0x00d4ff).setTimestamp();
      await interaction.reply({ embeds: [embed] });
      if (interaction.client) restartSpawner(interaction.client, guildId, channel.id);
    },
  },

  // ── /forcespawn ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("forcespawn").setDescription('Force a spawn. Use "vbucks","pack","founders pack","founder box", or a skin name.').addStringOption((o) => o.setName("skin").setDescription('Skin name, "vbucks", "pack", "founders pack", "founder box", or leave blank for random').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channelId = getSpawnChannel(guildId);
      if (!channelId) return interaction.reply({ content: "❌ No spawn channel! Use `/setup` first.", ephemeral: true });
      const active = getActiveSpawn(guildId);
      if (active) return interaction.reply({ content: `⚠️ Something is already spawned! Someone needs to type \`buy\` first.`, ephemeral: true });
      const query = (interaction.options.getString("skin") ?? "").toLowerCase().trim();
      if (query === "vbucks") {
        await interaction.reply({ content: `💰 Spawning **V-Bucks drop** in <#${channelId}>...`, ephemeral: true });
        await spawnVbucks(interaction.client, guildId, channelId, true);
      } else if (query === "pack" || query === "stw" || query === "stw packs") {
        await interaction.reply({ content: `📦 Spawning **STW Packs** in <#${channelId}>...`, ephemeral: true });
        await spawnStwPacks(interaction.client, guildId, channelId, true);
      } else if (query.includes("founders pack") || query === "founders" || query === "founder pack") {
        await interaction.reply({ content: `🌟 Spawning **Founders Pack** in <#${channelId}>...`, ephemeral: true });
        await spawnFoundersPack(interaction.client, guildId, channelId, true);
      } else if (query.includes("founder box") || query.includes("founders box")) {
        await interaction.reply({ content: `📦 Spawning **Founders Box** in <#${channelId}>...`, ephemeral: true });
        await spawnFoundersBox(interaction.client, guildId, channelId, true);
      } else if (query === "luck" || query === "luck potion") {
        await interaction.reply({ content: `🍀 Spawning **Luck Potion** in <#${channelId}>...`, ephemeral: true });
        await spawnLuckPotion(interaction.client, guildId, channelId, true, "luckPotion");
      } else if (query.includes("xtra") || query === "xtra luck") {
        await interaction.reply({ content: `🔮 Spawning **Xtra Luck Potion** in <#${channelId}>...`, ephemeral: true });
        await spawnLuckPotion(interaction.client, guildId, channelId, true, "xtraLuckPotion");
      } else if (query) {
        await interaction.deferReply({ ephemeral: true });
        const match = await findSkinByName(query);
        if (!match) { await interaction.editReply({ content: `❌ Couldn't find **"${query}"**. Check the name and try again.` }); return; }
        await interaction.editReply({ content: `🎮 Spawning **${match.name}** in <#${channelId}>...` });
        await spawnSkin(interaction.client, guildId, channelId, true, match);
      } else {
        await interaction.reply({ content: `🎮 Spawning random skin in <#${channelId}>...`, ephemeral: true });
        await spawnSkin(interaction.client, guildId, channelId, true);
      }
    },
  },

  // ── /spawn (give items to inventory) ────
  {
    data: new SlashCommandBuilder().setName("spawn").setDescription("Spawn an item into your inventory!").addStringOption((o) => o.setName("item").setDescription("What to spawn?").setRequired(true).addChoices({ name: "🍀 Luck Potion", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion", value: "xtraLuckPotion" }, { name: "📦 Founders Box", value: "foundersBox" })).addIntegerOption((o) => o.setName("amount").setDescription("How many? (default 1)").setMinValue(1).setMaxValue(10)),
    async execute(interaction) {
      const item = interaction.options.getString("item");
      const amount = interaction.options.getInteger("amount") || 1;
      const player = getUser(interaction.user.id);
      const field = item === "foundersBox" ? "foundersBoxes" : item;
      player[field] = (player[field] || 0) + amount;
      const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion", foundersBox: "📦 Founders Box" };
      const embed = new EmbedBuilder().setColor("#27ae60").setTitle("✨ Item Spawned!").setDescription(`Spawned **${amount}x ${labels[item]}** into your inventory!`).addFields({ name: "New Total", value: String(player[field]), inline: true }).setFooter({ text: "/spawn" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /givespawn (admin force-give anything) ─
  {
    data: new SlashCommandBuilder().setName("givespawn").setDescription("(Admin) Force spawn ANY item directly into your inventory, including Godly Luck Potions.").addStringOption((o) => o.setName("item").setDescription("What to force give?").setRequired(true).addChoices({ name: "🍀 Luck Potion", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion", value: "xtraLuckPotion" }, { name: "⚡ Godly Luck Potion", value: "godlyLuckPotion" }, { name: "📦 Founders Box", value: "foundersBox" }, { name: "🔵 Mysterious Chest", value: "mysteriousChest" }, { name: "🌟 God Chest", value: "godChest" })).addIntegerOption((o) => o.setName("amount").setDescription("How many?").setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const item = interaction.options.getString("item");
      const amount = interaction.options.getInteger("amount") || 1;
      const player = getUser(interaction.user.id);
      const field = item === "foundersBox" ? "foundersBoxes" : item;
      player[field] = (player[field] || 0) + amount;
      const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion", godlyLuckPotion: "⚡ Godly Luck Potion", foundersBox: "📦 Founders Box", mysteriousChest: "🔵 Mysterious Chest", godChest: "🌟 God Chest" };
      const embed = new EmbedBuilder().setColor("#e74c3c").setTitle("⚡ FORCE SPAWN!").setDescription(`Force spawned **${amount}x ${labels[item]}** into your inventory!`).addFields({ name: "New Total", value: String(player[field]), inline: true }).setFooter({ text: "/givespawn — admin power" });
      await interaction.reply({ embeds: [embed] });
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
      const nextMilestone = 30 - (user.interactionCount % 30);
      const embed = new EmbedBuilder().setTitle("💰 V-Bucks Balance")
        .setDescription(`**${interaction.user.username}**, here's your wallet:\n\n💰 **${user.infiniteVbucks ? "INFINITE ∞" : user.vbucks.toLocaleString()} V-Bucks**\n\n📊 **Level:** ${user.level} · **XP:** ${user.xp}\n💬 **Interactions:** ${user.interactionCount}\n🎁 **Next bonus in:** ${nextMilestone} interactions\n\n*Earn 250 V-Bucks every 30 bot interactions!*`)
        .setColor(0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
        .setFooter({ text: gainedVbucks ? "🎉 You just earned 250 V-Bucks for reaching a milestone!" : "Fortnite Skin Catcher" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /itemshop ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("itemshop").setDescription("Browse today's Item Shop! 5 skins for V-Bucks"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId);
      addInteraction(userId);
      progressQuest(userId, "check_shop");
      const skins = await ensureShopFresh();
      let page = 0;
      const buildPage = (p) => {
        const skin = skins[p];
        const user = getUser(userId);
        const discount = user.creatorDiscount ?? 0;
        const finalPrice = Math.floor(skin.price * (1 - discount));
        const discountPct = Math.round(discount * 100);
        const embed = new EmbedBuilder().setTitle(`🛒 Item Shop — Skin ${p + 1} of ${skins.length}`)
          .setDescription(`${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ Rarity: **${skin.rarity}**\n\n💰 **Price: ${finalPrice.toLocaleString()} V-Bucks**${user.hasCreatorCode ? ` 🏷️ *(${discountPct}% off)*` : ""}\n\n🔄 Shop resets in **${getTimeUntilReset()}**`)
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
          const skin = skins[page];
          const freshUser = getUser(userId);
          const finalPrice = Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
          if (!freshUser.infiniteVbucks && freshUser.vbucks < finalPrice) {
            if (!freshUser.brokeAttempt) { updateUser(userId, { brokeAttempt: true }); const ach = awardAchievement(userId, "broke"); await btn.reply({ content: `❌ You need **${finalPrice.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: ach ? [buildAchievementEmbed(ach)] : [] }); }
            else await btn.reply({ content: `❌ Not enough V-Bucks!` });
            return;
          }
          if (freshUser.inventory.includes(skin.skinId)) { await btn.reply({ content: `⚠️ You already own **${skin.name}**!` }); return; }
          if (!freshUser.infiniteVbucks) addVbucks(userId, -finalPrice);
          addSkinToInventory(userId, skin.skinId, skin.name);
          updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: finalPrice } });
          checkAndAwardAchievements(userId);
          const updated = getUser(userId);
          const confirmEmbed = new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n💰 Spent: ${finalPrice.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n*Use \`/refund\` if you change your mind.*`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp();
          await btn.reply({ embeds: [confirmEmbed] });
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
      resetQuestsIfNeeded(userId);
      addInteraction(userId);
      if (isEliminated(userId)) { const m = Math.ceil(getEliminationTimeLeft(userId) / 60000); await interaction.editReply({ content: `☠️ You've been eliminated! Can't buy for **${m} minute${m !== 1 ? "s" : ""}**. Ask someone to \`/reboot\` you.` }); return; }
      const skins = await ensureShopFresh();
      const user = getUser(userId);
      const isFreeWeek = hasActiveFreeSkin(userId);
      const discount = isFreeWeek ? 1 : (user.creatorDiscount ?? 0);
      const options = skins.map((s, i) => {
        const finalPrice = isFreeWeek ? 0 : Math.floor(s.price * (1 - discount));
        return new StringSelectMenuOptionBuilder().setLabel(isFreeWeek ? `${s.name} — FREE 🎁` : `${s.name} — ${finalPrice.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i));
      });
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("buy_select").setPlaceholder("Choose a skin to buy...").addOptions(options));
      const embed = new EmbedBuilder().setTitle(isFreeWeek ? "🎁 Free Skin Week! Pick Your Skin" : "🛒 Buy a Skin").setDescription(isFreeWeek ? "You have a **free skin** from the Tylajadee creator code!" : `You have **${user.vbucks.toLocaleString()} V-Bucks**.\n\nSelect a skin:`).setColor(isFreeWeek ? 0xffd700 : 0x00d4ff).setTimestamp();
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const idx = parseInt(sel.values[0]);
        const skin = skins[idx];
        const freshUser = getUser(userId);
        const freshFree = hasActiveFreeSkin(userId);
        const finalPrice = freshFree ? 0 : Math.floor(skin.price * (1 - (freshUser.creatorDiscount ?? 0)));
        if (!freshFree && !freshUser.infiniteVbucks && freshUser.vbucks < finalPrice) { await sel.update({ content: `❌ You need **${finalPrice.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: [], components: [] }); return; }
        if (freshUser.inventory.includes(skin.skinId)) { await sel.update({ content: `⚠️ You already own **${skin.name}**!`, embeds: [], components: [] }); return; }
        if (finalPrice > 0 && !freshUser.infiniteVbucks) addVbucks(userId, -finalPrice);
        addSkinToInventory(userId, skin.skinId, skin.name);
        updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), skin.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [skin.skinId]: finalPrice }, ...(freshFree ? { freeSkinRedeemed: true } : {}) });
        checkAndAwardAchievements(userId);
        const updated = getUser(userId);
        const successEmbed = new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`${getRarityEmoji(skin.rarity)} You bought **${skin.name}**!\n\n💰 **Spent:** ${finalPrice.toLocaleString()} V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n*Use \`/refund\` if you change your mind.*`).setColor(getRarityColor(skin.rarity)).setThumbnail(skin.imageUrl).setTimestamp();
        await sel.update({ embeds: [successEmbed], components: [] });
        collector.stop();
      });
      collector.on("end", (_, reason) => { if (reason === "time") interaction.editReply({ content: "⏰ Selection timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /gift ────────────────────────────────
  {
    data: new SlashCommandBuilder().setName("gift").setDescription("Gift a skin from the Item Shop to another player").addUserOption((o) => o.setName("player").setDescription("Player to gift to").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const target = interaction.options.getUser("player", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't gift yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't gift bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const skins = await ensureShopFresh();
      const user = getUser(userId);
      const options = skins.map((s, i) => new StringSelectMenuOptionBuilder().setLabel(`${s.name} — ${s.price.toLocaleString()} V-Bucks`).setDescription(`${getRarityEmoji(s.rarity)} ${s.rarity}`).setValue(String(i)));
      const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("gift_select").setPlaceholder("Choose a skin to gift...").addOptions(options));
      const embed = new EmbedBuilder().setTitle(`🎁 Gift a Skin to ${target.username}`).setDescription(`Your balance: **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks**\n\nSelect a skin:`).setColor(0xff69b4).setTimestamp();
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const skin = skins[parseInt(sel.values[0])];
        const freshUser = getUser(userId);
        if (!freshUser.infiniteVbucks && freshUser.vbucks < skin.price) { await sel.update({ content: `❌ Need **${skin.price.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: [], components: [] }); return; }
        const targetUser = getUser(target.id);
        if (targetUser.inventory.includes(skin.skinId)) {
          const alreadyEmbed = new EmbedBuilder().setTitle("⚠️ They Already Own This Skin!").setDescription(`**${target.username}** already owns **${skin.name}**!\n\nWould you like to send them **1,500 V-Bucks** instead?`).setColor(0xffaa00).setTimestamp();
          const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("gift_vbucks_yes").setLabel("✅ Yes — Send 1,500 V-Bucks").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("gift_vbucks_no").setLabel("❌ No — Cancel").setStyle(ButtonStyle.Danger));
          await sel.update({ embeds: [alreadyEmbed], components: [confirmRow] }); collector.stop();
          const btnMsg = await interaction.fetchReply();
          const btnCol = btnMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000, filter: (b) => b.user.id === userId });
          btnCol.on("collect", async (btn) => {
            if (btn.customId === "gift_vbucks_yes") {
              const latest = getUser(userId);
              if (!latest.infiniteVbucks && latest.vbucks < 1500) { await btn.update({ content: "❌ Not enough V-Bucks!", embeds: [], components: [] }); return; }
              if (!latest.infiniteVbucks) addVbucks(userId, -1500);
              addVbucks(target.id, 1500);
              const after = getUser(userId);
              await btn.update({ embeds: [new EmbedBuilder().setTitle("💸 V-Bucks Transferred!").setDescription(`Sent **1,500 V-Bucks** to <@${target.id}>!\n💳 **Remaining:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()], components: [] });
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
        if (interaction.channel?.send) await interaction.channel.send({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🎁 You received a gift!").setDescription(`<@${userId}> sent you **${skin.name}**!\n${getRarityEmoji(skin.rarity)} Rarity: **${skin.rarity}**\n\nCheck \`/inventory\`!`).setColor(getRarityColor(skin.rarity)).setImage(skin.imageUrl).setTimestamp()] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  // ── /coinflip ────────────────────────────
  {
    data: new SlashCommandBuilder().setName("coinflip").setDescription("Challenge another player to a V-Bucks coin flip!").addUserOption((o) => o.setName("player").setDescription("Player to challenge").setRequired(true)).addIntegerOption((o) => o.setName("amount").setDescription("V-Bucks to bet (default: 100)").setMinValue(10).setMaxValue(10000)),
    async execute(interaction) {
      const userId = interaction.user.id;
      const target = interaction.options.getUser("player", true);
      const amount = interaction.options.getInteger("amount") ?? 100;
      if (target.id === userId) { await interaction.reply({ content: "❌ Can't challenge yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't challenge bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId);
      if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.reply({ content: `❌ You need **${amount.toLocaleString()} V-Bucks** but only have **${challenger.vbucks.toLocaleString()}**.` }); return; }
      const targetUser = getUser(target.id);
      if (!targetUser.infiniteVbucks && targetUser.vbucks < amount) { await interaction.reply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks (needs ${amount.toLocaleString()}).` }); return; }
      progressQuest(userId, "challenge_flip");
      const challengeId = `${userId}_${target.id}_${Date.now()}`;
      const embed = new EmbedBuilder().setTitle("🪙 Coin Flip Challenge!").setDescription(`<@${userId}> challenged <@${target.id}> to a coin flip!\n\n💰 **Bet:** ${amount.toLocaleString()} V-Bucks\n\n<@${target.id}>, pick your side!`).setColor(0xf4a01a).setTimestamp();
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`flip_heads_${challengeId}`).setLabel("🪙 Heads").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_tails_${challengeId}`).setLabel("🪙 Tails").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`flip_decline_${challengeId}`).setLabel("❌ Decline").setStyle(ButtonStyle.Danger));
      const msg = await interaction.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row], fetchReply: true });
      setCoinflipChallenge(challengeId, { challengerId: userId, challengedId: target.id, amount, expiresAt: Date.now() + 60000 });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id || b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.user.id !== target.id && !btn.customId.includes("decline")) { await btn.reply({ content: "❌ Only the challenged player can pick!", ephemeral: true }); return; }
        const challenge = getCoinflipChallenge(challengeId);
        if (!challenge) { await btn.update({ content: "❌ Challenge expired.", embeds: [], components: [] }); return; }
        if (btn.customId.includes("decline")) { deleteCoinflipChallenge(challengeId); await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Challenge Declined").setDescription(`<@${target.id}> declined.`).setColor(0xff0000).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
        const pickedHeads = btn.customId.includes("heads");
        const result = Math.random() < 0.5 ? "heads" : "tails";
        const won = (pickedHeads && result === "heads") || (!pickedHeads && result === "tails");
        const winnerId = won ? target.id : userId;
        const loserId = won ? userId : target.id;
        if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
        addVbucks(winnerId, amount);
        addXP(winnerId, 100);
        const winnerUser = getUser(winnerId); winnerUser.coinflipsWon = (winnerUser.coinflipsWon ?? 0) + 1;
        checkAndAwardAchievements(winnerId);
        progressQuest(won ? target.id : userId, "win_coinflip");
        deleteCoinflipChallenge(challengeId);
        await btn.update({ embeds: [new EmbedBuilder().setTitle(`🪙 The coin landed on **${result.toUpperCase()}**!`).setDescription(`${btn.user.username} picked **${pickedHeads ? "Heads" : "Tails"}**.\n\n🏆 **<@${winnerId}> wins ${amount.toLocaleString()} V-Bucks!**\n💸 <@${loserId}> loses ${amount.toLocaleString()} V-Bucks.`).setColor(won ? 0x00ff00 : 0xff0000).setTimestamp()], components: [], content: "" });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") { deleteCoinflipChallenge(challengeId); interaction.editReply({ content: "⏰ Coin flip expired.", embeds: [], components: [] }).catch(() => {}); } });
    },
  },

  // ── /savetheworld ────────────────────────
  {
    data: new SlashCommandBuilder().setName("savetheworld").setDescription("View your Save the World quests and earn XP to level up"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const buildEmbed2 = () => {
        const user = getUser(userId);
        const levelInfo = calculateLevelFromXP(user.xp);
        const bar = "█".repeat(Math.round((levelInfo.xpInLevel / levelInfo.xpForNext) * 10)) + "░".repeat(10 - Math.round((levelInfo.xpInLevel / levelInfo.xpForNext) * 10));
        const questLines = user.quests.map((q) => { const done = q.completed ? "✅" : "🔲"; const qBar = "█".repeat(Math.round((q.current / q.required) * 8)) + "░".repeat(8 - Math.round((q.current / q.required) * 8)); return `${done} **${q.label}**\n   \`${qBar}\` ${q.current}/${q.required} · +${q.xpReward} XP`; });
        return new EmbedBuilder().setTitle("⚡ Save the World").setDescription(`**${interaction.user.username}** — Level **${user.level}** · **${user.boxes}** box(es)\n\n**XP Progress:**\n\`${bar}\` ${levelInfo.xpInLevel}/${levelInfo.xpForNext}\n\n**Daily Quests:**\n\n${questLines.join("\n\n")}\n\n*Quests reset every 24h. Level up to earn STW Boxes!*`).setColor(0xff6600).setFooter({ text: "Complete quests to level up and earn STW Boxes!" }).setTimestamp();
      };
      const buildRow2 = () => {
        const user = getUser(userId);
        return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`stw_openbox_${userId}`).setLabel(user.boxes > 0 ? `🎁 Open Box (${user.boxes} available)` : "🎁 No Boxes Yet").setStyle(user.boxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(user.boxes === 0), new ButtonBuilder().setCustomId(`stw_refresh_${userId}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Primary));
      };
      const msg = await interaction.reply({ embeds: [buildEmbed2()], components: [buildRow2()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId.startsWith("stw_refresh")) { resetQuestsIfNeeded(userId); await btn.update({ embeds: [buildEmbed2()], components: [buildRow2()] }); return; }
        if (btn.customId.startsWith("stw_openbox")) {
          const freshUser = getUser(userId);
          if (freshUser.boxes <= 0) { await btn.reply({ content: "❌ No boxes!", ephemeral: true }); return; }
          updateUser(userId, { boxes: freshUser.boxes - 1, boxesOpened: (freshUser.boxesOpened ?? 0) + 1 }); checkAndAwardAchievements(userId);
          let resultEmbed;
          if (Math.random() < 0.2) { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 You found **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); }
          else {
            const stwSkin = await getRandomStwSkin();
            if (stwSkin) { addSkinToInventory(userId, stwSkin.id, stwSkin.name); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`${getRarityEmoji(stwSkin.rarity)} You found **${stwSkin.name}**!\n✨ Rarity: **${stwSkin.rarity}**\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(getRarityColor(stwSkin.rarity)).setImage(stwSkin.imageUrl).setTimestamp(); }
            else { addVbucks(userId, 250); resultEmbed = new EmbedBuilder().setTitle("🎁 STW Box Opened!").setDescription(`💰 **250 V-Bucks**!\n\n*Boxes remaining: ${freshUser.boxes - 1}*`).setColor(0xf4a01a).setTimestamp(); }
          }
          await btn.reply({ embeds: [resultEmbed] });
          await interaction.editReply({ components: [buildRow2()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /founderspack (new quest system) ────
  {
    data: new SlashCommandBuilder().setName("founderspack").setDescription("Get easy Founders Pack quests! Complete them for Founders Boxes (separate from /savetheworld)"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const player = getUser(userId);
      if (!player.hasFoundersPack) { await interaction.reply({ content: "❌ You need a **Founders Pack** first! Watch the spawn channel and type `buy` when one appears." }); return; }
      if (player.foundersQuestPending && player.foundersQuestPending.length > 0) {
        const questLines = player.foundersQuestPending.map((q, i) => `**Quest ${i + 1}:** ${q}`).join("\n");
        const embed = new EmbedBuilder().setColor("#FF6B35").setTitle("📋 Your Active Founders Quests").setDescription(`You still have active quests:\n\n${questLines}\n\nUse \`/completefoundersquests\` to turn them in!`).setFooter({ text: "Complete all quests to earn Founders Boxes!" });
        await interaction.reply({ embeds: [embed] }); return;
      }
      const quests = pickRandom(FOUNDERS_QUESTS_POOL, 3);
      updateUser(userId, { foundersQuestPending: quests });
      const embed = new EmbedBuilder().setColor("#FF6B35").setTitle("📋 Founders Pack Quests").setDescription("Complete these quests to earn **Founders Boxes**!")
        .addFields(quests.map((q, i) => ({ name: `Quest ${i + 1}`, value: q, inline: false })))
        .setFooter({ text: "Use /completefoundersquests when done!" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /completefoundersquests ──────────────
  {
    data: new SlashCommandBuilder().setName("completefoundersquests").setDescription("Turn in your active Founders Pack quests to earn Founders Boxes"),
    async execute(interaction) {
      const userId = interaction.user.id;
      const player = getUser(userId);
      if (!player.foundersQuestPending || player.foundersQuestPending.length === 0) { await interaction.reply({ content: "❌ You have no active Founders quests! Use `/founderspack` to get some." }); return; }
      const count = player.foundersQuestPending.length;
      updateUser(userId, { foundersQuestPending: [], foundersBoxes: (player.foundersBoxes ?? 0) + count });
      const embed = new EmbedBuilder().setColor("#FF6B35").setTitle("✅ Founders Quests Complete!").setDescription(`You completed **${count}** quest(s) and earned **${count} Founders Box${count > 1 ? "es" : ""}**!`).addFields({ name: "📦 Founders Boxes", value: `You now have **${(player.foundersBoxes ?? 0) + count}** Founders Box${((player.foundersBoxes ?? 0) + count) !== 1 ? "es" : ""}`, inline: false }).setFooter({ text: "Use /founderpack to open them!" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /founderpack (original box opener) ──
  {
    data: new SlashCommandBuilder().setName("founderpack").setDescription("Open your Founders Boxes and view Founders Pack rewards"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!user.hasFoundersPack) {
        if ((user.foundersBoxes ?? 0) > 0) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📦 You Have a Founders Box Waiting!").setDescription(`You have **${user.foundersBoxes}** Founders Box${user.foundersBoxes > 1 ? "es" : ""} waiting — but no **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when a Founders Pack appears!`).setColor(0xffd700).setImage(FOUNDERS_PACK_IMAGE).setTimestamp()] }); return; }
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔒 Founders Pack Required").setDescription(`You don't own a **Founders Pack** yet!\n\nWatch the spawn channel and type \`buy\` when one appears!`).setColor(0xff4444).setImage(FOUNDERS_PACK_IMAGE).setTimestamp()] }); return;
      }
      const buildFPEmbed = () => { const fu = getUser(userId); return new EmbedBuilder().setTitle("🌟 Founders Pack").setDescription(`Welcome, Founder! 🎉\n\n**Founders Boxes available:** ${fu.foundersBoxes}\n**Founders Boxes opened:** ${fu.foundersBoxesOpened ?? 0}\n\n**Box Rewards:**\n> 💰 100 V-Bucks — *40%*\n> 💰 200 V-Bucks — *30%*\n> 💰 350 V-Bucks — *20%*\n> 💰 550 V-Bucks — *10%*\n\n*Also has a 5% chance for a 🌟 God Chest!*`).setColor(0xffd700).setImage(FOUNDERS_BOX_IMAGE).setTimestamp(); };
      const buildFPRow = () => { const fu = getUser(userId); return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fp_open").setLabel(fu.foundersBoxes > 0 ? `📦 Open Box (${fu.foundersBoxes} available)` : "📦 No Boxes").setStyle(fu.foundersBoxes > 0 ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(fu.foundersBoxes === 0), new ButtonBuilder().setCustomId("fp_refresh").setLabel("🔄 Refresh").setStyle(ButtonStyle.Primary)); };
      const msg = await interaction.reply({ embeds: [buildFPEmbed()], components: [buildFPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId === "fp_refresh") { await btn.update({ embeds: [buildFPEmbed()], components: [buildFPRow()] }); return; }
        if (btn.customId === "fp_open") {
          const fu = getUser(userId);
          if ((fu.foundersBoxes ?? 0) <= 0) { await btn.reply({ content: "❌ No Founders Boxes!", ephemeral: true }); return; }
          updateUser(userId, { foundersBoxes: fu.foundersBoxes - 1, foundersBoxesOpened: (fu.foundersBoxesOpened ?? 0) + 1 });
          // 5% god chest chance (boosted by luck)
          const godChestChance = boostedChance(5, fu.activeLuck ?? "none");
          if (roll(godChestChance)) {
            updateUser(userId, { godChest: (fu.godChest ?? 0) + 1 });
            const godRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_godchest_${userId}`).setLabel("🌟 Open God Chest").setStyle(ButtonStyle.Success));
            const godEmbed = new EmbedBuilder().setColor("#FFD700").setTitle("🌟 GOD CHEST INCOMING!").setDescription("A **GOLD GOD CHEST** has appeared from your Founders Box!\n\nThis is extremely rare. Do you dare open it?\n\n> ⚡ **GOD TIER ⚡**").setFooter({ text: "Click to open!" });
            await btn.reply({ embeds: [godEmbed], components: [godRow] });
            const godMsg = await btn.fetchReply();
            const godCol = godMsg.createMessageComponentCollector({ time: 60000 });
            godCol.on("collect", async (b2) => {
              if (b2.user.id !== userId) return b2.reply({ content: "❌ Not your chest!", ephemeral: true });
              await openGodChest(b2, getUser(userId));
              godCol.stop();
            });
          } else {
            const won = rollFoundersBoxVbucks();
            addVbucks(userId, won);
            const afterUser = getUser(userId);
            const resultEmbed = new EmbedBuilder().setTitle("📦 Founders Box Opened!").setDescription(`🎉 You found **${won.toLocaleString()} V-Bucks** inside!\n\n💳 **New balance:** ${afterUser.infiniteVbucks ? "∞" : afterUser.vbucks.toLocaleString()} V-Bucks\n📦 **Boxes remaining:** ${afterUser.foundersBoxes}`).setColor(0xffd700).setTimestamp();
            await btn.reply({ embeds: [resultEmbed] });
          }
          await interaction.editReply({ components: [buildFPRow()] }).catch(() => {});
        }
      });
      collector.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /opengodchest ────────────────────────
  {
    data: new SlashCommandBuilder().setName("opengodchest").setDescription("Open a God Chest from your inventory"),
    async execute(interaction) {
      const player = getUser(interaction.user.id);
      if (player.godChest <= 0) return interaction.reply({ content: "❌ You have no God Chests!", ephemeral: true });
      await openGodChest(interaction, player);
    },
  },

  // ── /openmysterious ──────────────────────
  {
    data: new SlashCommandBuilder().setName("openmysterious").setDescription("Open a Mysterious Chest from your inventory"),
    async execute(interaction) {
      const player = getUser(interaction.user.id);
      if (player.mysteriousChest <= 0) return interaction.reply({ content: "❌ You have no Mysterious Chests!", ephemeral: true });
      await openMysteriousChest(interaction, player);
    },
  },

  // ── /inventory ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("inventory").setDescription("View your Fortnite skin collection and items"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const skinEntries = Object.entries(user.inventoryNames);
      const luck = user.activeLuck === "none" ? "None" : { normal: "🍀 Luck Potion (+15%)", xtra: "🔮 Xtra Luck Potion (+40%)", godly: "⚡ Godly Luck Potion (+80%)" }[user.activeLuck];
      if (skinEntries.length === 0 && user.luckPotion === 0 && user.xtraLuckPotion === 0 && user.godlyLuckPotion === 0 && user.foundersBoxes === 0) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎒 Your Inventory").setDescription("You have nothing yet!\n• Wait for a skin to spawn and type `buy`\n• Use `/daily` for free V-Bucks\n• Open the Item Shop with `/itemshop`").setColor(0x888888).setTimestamp()] }); return;
      }
      const names = skinEntries.map(([, n]) => n);
      const totalPages = Math.max(1, Math.ceil(names.length / 10));
      let page = 0;
      const buildInvPage = (p) => {
        const slice = names.slice(p * 10, p * 10 + 10);
        const lines = slice.map((name, i) => `${p * 10 + i + 1}. **${name}**`);
        const itemsSection = `**Items:**\n🍀 Luck Potion: ${user.luckPotion || 0} | 🔮 Xtra: ${user.xtraLuckPotion || 0} | ⚡ Godly: ${user.godlyLuckPotion || 0}\n🌟 God Chests: ${user.godChest || 0} | 🔵 Mysterious: ${user.mysteriousChest || 0} | 📦 Founders Boxes: ${user.foundersBoxes || 0}`;
        const embed = new EmbedBuilder().setTitle(`🎒 ${interaction.user.username}'s Inventory`).setDescription((lines.length ? lines.join("\n") + "\n\n" : "*No skins yet.*\n\n") + itemsSection + `\n\n💰 V-Bucks: **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()}**\n✨ Active Luck: **${luck}**`).setColor(0x00d4ff).setFooter({ text: `Page ${p + 1} of ${totalPages} • ${names.length} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`inv_prev_${p}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0), new ButtonBuilder().setCustomId(`inv_next_${p}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1));
        return { embed, row };
      };
      const { embed, row } = buildInvPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId.startsWith("inv_prev")) page = Math.max(0, page - 1);
        else if (btn.customId.startsWith("inv_next")) page = Math.min(totalPages - 1, page + 1);
        const { embed: e, row: r } = buildInvPage(page);
        await btn.update({ embeds: [e], components: [r] });
      });
      collector.on("end", async () => { const { embed: e } = buildInvPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /trade ───────────────────────────────
  {
    data: new SlashCommandBuilder().setName("trade").setDescription("Offer a skin trade with another player").addUserOption((o) => o.setName("player").setDescription("Player to trade with").setRequired(true)),
    async execute(interaction) {
      const initiatorId = interaction.user.id;
      const target = interaction.options.getUser("player", true);
      if (target.id === initiatorId) { await interaction.reply({ content: "❌ Can't trade with yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't trade with bots!" }); return; }
      resetQuestsIfNeeded(initiatorId); addInteraction(initiatorId);
      const initUser = getUser(initiatorId); const targUser = getUser(target.id);
      const initSkins = Object.entries(initUser.inventoryNames); const targSkins = Object.entries(targUser.inventoryNames);
      if (!initSkins.length) { await interaction.reply({ content: "❌ You have no skins to trade!" }); return; }
      if (!targSkins.length) { await interaction.reply({ content: `❌ <@${target.id}> has no skins!` }); return; }
      let initPick = null, targPick = null;
      const embed = new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> wants to trade with <@${target.id}>!\n\n**<@${initiatorId}>** — pick your skin below.`).setColor(0x00d4ff).setFooter({ text: "Expires in 2 minutes" }).setTimestamp();
      const initRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_initiator_${initiatorId}`).setPlaceholder(`${interaction.user.username}, pick your skin...`).addOptions(initSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
      const msg = await interaction.reply({ content: `<@${initiatorId}> <@${target.id}>`, embeds: [embed], components: [initRow], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 2 * 60 * 1000, filter: (i) => i.user.id === initiatorId || i.user.id === target.id });
      collector.on("collect", async (i) => {
        if (i.isStringSelectMenu()) {
          if (i.customId.startsWith("trade_initiator") && i.user.id === initiatorId) {
            initPick = { key: i.values[0], name: initUser.inventoryNames[i.values[0]] };
            const targetRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_target_${target.id}`).setPlaceholder(`${target.username}, pick your skin...`).addOptions(targSkins.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> is offering **${initPick.name}**.\n\n<@${target.id}>, pick what you'd like to offer!`).setColor(0xf4a01a).setTimestamp()], components: [targetRow] }); return;
          }
          if (i.customId.startsWith("trade_target") && i.user.id === target.id) {
            if (!initPick) { await i.reply({ content: "❌ Wait for the other player!", ephemeral: true }); return; }
            targPick = { key: i.values[0], name: targUser.inventoryNames[i.values[0]] };
            const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trade_confirm_initiator").setLabel(`✅ ${interaction.user.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_confirm_target").setLabel(`✅ ${target.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Confirm Trade").setDescription(`**<@${initiatorId}>** offers: **${initPick.name}**\n**<@${target.id}>** offers: **${targPick.name}**\n\nBoth must confirm!`).setColor(0x1a9b1a).setTimestamp()], components: [confirmRow] }); return;
          }
        }
        if (i.isButton()) {
          if (i.customId === "trade_cancel") { await i.update({ content: "❌ Trade cancelled.", embeds: [], components: [] }); collector.stop(); return; }
          if (i.customId === "trade_confirm_initiator" && i.user.id !== initiatorId) { await i.reply({ content: "❌ Only the initiator!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && i.user.id !== target.id) { await i.reply({ content: `❌ Only <@${target.id}>!`, ephemeral: true }); return; }
          if (i.customId === "trade_confirm_initiator") {
            await i.update({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trade_confirm_initiator").setLabel(`✅ ${interaction.user.username} ✓`).setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId("trade_confirm_target").setLabel(`✅ ${target.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger))] }); return;
          }
          if (i.customId === "trade_confirm_target" && initPick && targPick) {
            const freshInit = getUser(initiatorId); const freshTarg = getUser(target.id);
            delete freshInit.inventoryNames[initPick.key]; freshInit.inventory = freshInit.inventory.filter((id) => id !== initPick.key.split("_")[0]); freshInit.inventoryNames[targPick.key + "_traded"] = targPick.name; freshInit.inventory.push(targPick.key.split("_")[0]);
            delete freshTarg.inventoryNames[targPick.key]; freshTarg.inventory = freshTarg.inventory.filter((id) => id !== targPick.key.split("_")[0]); freshTarg.inventoryNames[initPick.key + "_traded"] = initPick.name; freshTarg.inventory.push(initPick.key.split("_")[0]);
            freshInit.tradesCompleted = (freshInit.tradesCompleted ?? 0) + 1; freshTarg.tradesCompleted = (freshTarg.tradesCompleted ?? 0) + 1;
            updateUser(initiatorId, freshInit); updateUser(target.id, freshTarg); checkAndAwardAchievements(initiatorId); checkAndAwardAchievements(target.id);
            await i.update({ embeds: [new EmbedBuilder().setTitle("✅ Trade Complete!").setDescription(`**<@${initiatorId}>** received **${targPick.name}**\n**<@${target.id}>** received **${initPick.name}**\n\nCheck \`/inventory\`!`).setColor(0x00ff00).setTimestamp()], components: [], content: "" });
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
      const shopSkins = skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: 1500 }));
      setItemShop(shopSkins);
      const lines = shopSkins.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · ${s.rarity}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🛒 Item Shop Reset!").setDescription(`New skins:\n\n${lines.join("\n")}\n\nUse \`/itemshop\` to browse!`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  // ── /leaderboard ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("leaderboard").setDescription("View top players ranked by skins, V-Bucks, or level"),
    async execute(interaction) {
      await interaction.deferReply();
      let mode = "skins";
      const buildLBEmbed = async (m) => {
        const guild = interaction.guild;
        const allUsers2 = getAllUsers();
        const entries = await Promise.all(Object.entries(allUsers2).map(async ([uid, d]) => {
          let name = `User ${uid.slice(-4)}`;
          if (guild) { try { const mem = await guild.members.fetch(uid).catch(() => null); if (mem) name = mem.displayName; } catch {} }
          const lvl = calculateLevelFromXP(d.xp);
          return { uid, name, skins: d.inventory.length, vbucks: d.vbucks, level: lvl.level, xp: d.xp };
        }));
        const sorted = [...entries].sort((a, b) => m === "skins" ? b.skins - a.skins : m === "vbucks" ? b.vbucks - a.vbucks : b.xp - a.xp);
        const top = sorted.slice(0, 10);
        const medals = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `**${r}.**`;
        const modeLabel = m === "skins" ? "🎮 Most Skins" : m === "vbucks" ? "💰 Most V-Bucks" : "⭐ Highest Level";
        const lines2 = top.map((p, i) => `${medals(i + 1)} **${p.name}** — ${m === "skins" ? `${p.skins} skin(s)` : m === "vbucks" ? `${p.vbucks.toLocaleString()} V-Bucks` : `Level ${p.level} · ${p.xp.toLocaleString()} XP`}`);
        return new EmbedBuilder().setTitle(`🏆 Leaderboard — ${modeLabel}`).setDescription(lines2.length ? lines2.join("\n") : "No players yet!").setColor(0xf4a01a).setFooter({ text: `Top ${Math.max(top.length, 1)} players` }).setTimestamp();
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
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const now = Date.now(), last = user.lastDailyClaim ?? 0, since = now - last;
      if (since < 24 * 60 * 60 * 1000) {
        const left = 24 * 60 * 60 * 1000 - since;
        const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
        const nextReward = 150 + (user.dailyStreak) * 100;
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏰ Already Claimed!").setDescription(`Already claimed today.\n\n⏳ **Next claim in:** ${h}h ${m}m\n🔥 **Streak:** ${user.dailyStreak} day(s)\n${"🔥".repeat(Math.min(user.dailyStreak, 7)) + "⬜".repeat(7 - Math.min(user.dailyStreak, 7))}\n💰 **Tomorrow's reward:** ${nextReward} V-Bucks`).setColor(0xff6600).setTimestamp()] }); return;
      }
      let newStreak = last === 0 || since >= 48 * 60 * 60 * 1000 ? 1 : (user.dailyStreak ?? 0) + 1;
      const reward = 150 + (newStreak - 1) * 100;
      const streakBroken = last !== 0 && since >= 48 * 60 * 60 * 1000 && (user.dailyStreak ?? 0) > 1;
      addVbucks(userId, reward); addXP(userId, 75);
      updateUser(userId, { lastDailyClaim: now, dailyStreak: newStreak });
      const updated = getUser(userId);
      const tomorrowReward = 150 + newStreak * 100;
      let desc = (streakBroken ? "⚠️ **Your streak was reset!** You missed a day.\n\n" : newStreak > 1 ? `🎉 **${newStreak}-day streak!** Keep it up!\n\n` : "") + `💰 You received **${reward} V-Bucks**!\n💳 **New balance:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n🔥 **Streak:** ${newStreak} day(s)\n${"🔥".repeat(Math.min(newStreak, 7)) + "⬜".repeat(7 - Math.min(newStreak, 7))}\n📅 **Tomorrow's reward:** ${tomorrowReward} V-Bucks\n\n*Come back in 24 hours!*`;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Daily Reward Claimed!").setDescription(desc).setColor(newStreak >= 7 ? 0xf4a01a : newStreak >= 3 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "+75 XP bonus!" }).setTimestamp()] });
      checkAndAwardAchievements(userId);
    },
  },

  // ── /achievements ────────────────────────
  {
    data: new SlashCommandBuilder().setName("achievements").setDescription("View your achievements and how many you've unlocked"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const earned = new Set(user.achievementsEarned ?? []);
      let page = 0;
      const PAGE_SIZE = 8;
      const buildAchPage = (p) => {
        const total = ALL_ACHIEVEMENTS.length, totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const safePage = Math.min(p, totalPages - 1);
        const slice = ALL_ACHIEVEMENTS.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
        const lines = slice.map((a) => earned.has(a.id) ? `🏆 ${a.emoji} **${a.title}**\n   *${a.description}*` : `🔒 ~~${a.emoji} ${a.title}~~\n   ||${a.description}||`);
        const bar = "█".repeat(Math.round((earned.size / total) * 10)) + "░".repeat(10 - Math.round((earned.size / total) * 10));
        const embed = new EmbedBuilder().setTitle(`🏆 ${interaction.user.username}'s Achievements`).setDescription(`**Progress:** \`${bar}\` ${earned.size}/${total}\n\n${lines.join("\n\n")}`).setColor(earned.size === total ? 0xf4a01a : 0x00d4ff).setFooter({ text: `Page ${safePage + 1} of ${totalPages} • ${earned.size} of ${total} unlocked` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ach_prev_${safePage}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0), new ButtonBuilder().setCustomId(`ach_next_${safePage}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1));
        return { embed, row, totalPages, safePage };
      };
      const { embed, row } = buildAchPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        const { totalPages } = buildAchPage(page);
        if (btn.customId.startsWith("ach_prev")) page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1);
        const { embed: e, row: r } = buildAchPage(page);
        await btn.update({ embeds: [e], components: [r] });
      });
      collector.on("end", async () => { const { embed: e } = buildAchPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  // ── /refund ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("refund").setDescription("Request a refund for a skin you bought from the Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const user = getUser(userId);
      const shopSkins = user.shopSkins ?? [];
      if (!shopSkins.length) { await interaction.editReply({ content: "❌ No Item Shop skins eligible for refund. Only `/buy` or `/itemshop` skins can be refunded." }); return; }
      const refundable = [];
      const seen = new Set();
      for (const skinId of shopSkins) {
        if (seen.has(skinId) || !user.inventory.includes(skinId)) continue;
        seen.add(skinId);
        const nameKey = Object.keys(user.inventoryNames).find((k) => k.startsWith(skinId + "_")) ?? skinId;
        const name = user.inventoryNames[nameKey] ?? skinId;
        const price = (user.shopSkinPrices ?? {})[skinId] ?? 800;
        const isFree = (user.freeSkinIds ?? []).includes(skinId);
        refundable.push({ skinId, nameKey, name, price, isFree });
      }
      if (!refundable.length) { await interaction.editReply({ content: "❌ None of your shop purchases are still in your inventory." }); return; }
      const options = refundable.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.isFree ? `${s.name} 🎁 (FREE)` : s.name).setDescription(s.isFree ? "⚠️ This was FREE — consequences await" : `Refund: ${s.price.toLocaleString()} V-Bucks`).setValue(s.skinId));
      const selectRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("refund_select").setPlaceholder("Choose a skin to refund...").addOptions(options));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Item Shop Refund").setDescription("Select the skin to refund.\n\n⚠️ **Refunding a FREE skin will have consequences.**").setColor(0xff6600).setTimestamp()], components: [selectRow] });
      const selectCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      selectCol.on("collect", async (sel) => {
        selectCol.stop("selected");
        const skinId = sel.values[0]; const skin = refundable.find((s) => s.skinId === skinId);
        if (skin.isFree) {
          await sel.update({ content: "Processing...", embeds: [], components: [] });
          const fu = getUser(userId);
          const balanceLost = Math.floor(Math.abs(fu.vbucks) * 0.1);
          const newVbucks = fu.vbucks - balanceLost;
          const invIdx = fu.inventory.indexOf(skinId); if (invIdx !== -1) fu.inventory.splice(invIdx, 1);
          delete fu.inventoryNames[skin.nameKey];
          const randomSkinEntry = Object.entries(fu.inventoryNames).filter(([k]) => !k.startsWith(skinId + "_"))[0];
          let randomRemoved = null;
          if (randomSkinEntry) { randomRemoved = randomSkinEntry[1]; const rsId = randomSkinEntry[0].replace(/_\d+$/, ""); const rsIdx = fu.inventory.indexOf(rsId); if (rsIdx !== -1) fu.inventory.splice(rsIdx, 1); delete fu.inventoryNames[randomSkinEntry[0]]; }
          updateUser(userId, { inventory: fu.inventory, inventoryNames: fu.inventoryNames, shopSkins: (fu.shopSkins ?? []).filter((s) => s !== skinId), vbucks: newVbucks, eliminatedUntil: Date.now() + 5 * 60 * 1000 });
          const emailEmbed = new EmbedBuilder().setTitle("📧 You Have a New Email From Epic Games").setDescription(`**From:** noreply@epicgames.com\n**Subject:** Your Refund Request — Seriously?\n\n> Dear ${interaction.user.username},\n>\n> We noticed you tried to refund **${skin.name}**, which you got for FREE.\n>\n> Are you serious right now?\n>\n> We've gone ahead and:\n> — Removed **${skin.name}** from your locker\n> — Deducted **${balanceLost.toLocaleString()} V-Bucks** (10% of your balance)${randomRemoved ? `\n> — Also removed **${randomRemoved}** as a lesson` : ""}\n> — Suspended you for **5 minutes**\n>\n> You will receive no refund. Regards,\n> Epic Games Refund Team\n> *P.S. — You are literally so dumb lol*`).setColor(0xff0000).setTimestamp();
          awardAchievement(userId, "scammed");
          await interaction.editReply({ embeds: [emailEmbed], components: [] }); return;
        }
        const cooldowns = user.refundCooldowns ?? {};
        const coolLeft = (cooldowns[skinId] ?? 0) + 4 * 60 * 60 * 1000 - Date.now();
        if (coolLeft > 0) { const h = Math.floor(coolLeft / 3600000), m = Math.floor((coolLeft % 3600000) / 60000); await sel.update({ content: `⏳ Still under review for **${skin.name}**. Try again in **${h}h ${m}m**.`, embeds: [], components: [] }); return; }
        const fu2 = getUser(userId);
        const hasBribes = Object.entries(fu2.inventoryNames).some(([k]) => !(fu2.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
        const btnRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("refund_bribe").setLabel(hasBribes ? "💸 Bribe Epic Games" : "💸 No skins to bribe with").setStyle(ButtonStyle.Danger).setDisabled(!hasBribes), new ButtonBuilder().setCustomId("refund_request").setLabel("🙏 Request Anyway (33%)").setStyle(ButtonStyle.Secondary));
        await sel.update({ embeds: [new EmbedBuilder().setTitle("⚠️ Refund Warning").setDescription(`Refunding **${skin.name}**.\n\n💰 **Refund amount:** ${skin.price.toLocaleString()} V-Bucks\n\n📋 **Epic rejects 67% of all requests.**\n\n> 💸 **Bribe Epic** — sacrifice a skin for guaranteed approval\n> 🙏 **Request Anyway** — 33% chance, no cost`).setColor(0xff0000).setTimestamp()], components: [btnRow] });
        const btnCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        btnCol.on("collect", async (btn) => {
          btnCol.stop("clicked");
          const fu3 = getUser(userId);
          let approved = false, bribedSkin = null;
          if (btn.customId === "refund_bribe") {
            const bribes = Object.entries(fu3.inventoryNames).filter(([k]) => !(fu3.shopSkins ?? []).includes(k.replace(/_\d+$/, "")) && !k.startsWith(skinId + "_"));
            if (!bribes.length) { await btn.update({ content: "❌ No skins to bribe with!", embeds: [], components: [] }); return; }
            const bribe = bribes[Math.floor(Math.random() * bribes.length)];
            bribedSkin = bribe[1]; const bsId = bribe[0].replace(/_\d+$/, ""); const bIdx = fu3.inventory.indexOf(bsId); if (bIdx !== -1) fu3.inventory.splice(bIdx, 1); delete fu3.inventoryNames[bribe[0]];
            approved = true;
          } else approved = Math.random() < 0.33;
          if (approved) {
            const refIdx = fu3.inventory.indexOf(skinId); if (refIdx !== -1) fu3.inventory.splice(refIdx, 1);
            delete fu3.inventoryNames[skin.nameKey]; fu3.shopSkins = (fu3.shopSkins ?? []).filter((s) => s !== skinId);
            addVbucks(userId, skin.price); updateUser(userId, { inventory: fu3.inventory, inventoryNames: fu3.inventoryNames, shopSkins: fu3.shopSkins });
            awardAchievement(userId, "epic_likes_you"); checkAndAwardAchievements(userId);
            const bal = getUser(userId).vbucks;
            await btn.update({ embeds: [new EmbedBuilder().setTitle("✅ Refund Approved!").setDescription(`✅ **Epic approved your refund** for **${skin.name}**!\n💰 **+${skin.price.toLocaleString()} V-Bucks**\n💳 **New balance:** ${bal.toLocaleString()} V-Bucks${bribedSkin ? `\n\n🤝 You bribed them with **${bribedSkin}**. They deleted it immediately.` : ""}`).setColor(0x00ff00).setTimestamp()], components: [] });
          } else {
            const c2 = fu3.refundCooldowns ?? {}; c2[skinId] = Date.now(); updateUser(userId, { refundCooldowns: c2 });
            awardAchievement(userId, "epic_hates_you");
            await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Refund Denied!").setDescription(`❌ **Epic rejected your refund** for **${skin.name}**.\n\nNo reason given. Try again in **4 hours**.`).setColor(0xff0000).setTimestamp()], components: [] });
          }
        });
        btnCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
      });
      selectCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
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
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Hack Successful!").setDescription(`Epic Games was hacked and <@${target.id}> received **13,500 V-Bucks!**\n\n*Epic Games will never know.*`).setColor(0x00ff00).setTimestamp()] });
    },
  },

  // ── /freevbucks ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("freevbucks").setDescription("Claim free V-Bucks from a totally legit website!"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const lostAmount = Math.floor(user.vbucks * 0.25);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🤑 Free V-Bucks Generator — 100% LEGIT!!").setDescription("**Step 1:** Enter your Fortnite login ✅\n**Step 2:** Select amount: **FREE** ✅\n**Step 3:** Waiting for verification...\n\n*Please wait up to 7 days for your V-Bucks to arrive!*").setColor(0x00ff00).setFooter({ text: "freevbucks4real.biz • Totally not a virus" }).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 3000));
      addVbucks(userId, -lostAmount);
      const updated = getUser(userId);
      const ach = awardAchievement(userId, "scammed");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("😱 A Week Later...").setDescription(`You entered your login like a genius. A week later you noticed **${lostAmount.toLocaleString()} V-Bucks missing** — 25% of everything.\n\nYou cry as they change your skin to a **clown**.\n\nhaha.\n\n💳 **New balance:** ${updated.vbucks.toLocaleString()} V-Bucks${updated.vbucks <= 0 ? " *(you're broke)*" : ""}`).setColor(0xff0000).setImage("https://media.tenor.com/6GMIhZ4gjbIAAAAC/fortnite-clown.gif").setFooter({ text: "freevbucks4real.biz gave you a virus. Thanks for visiting!" }).setTimestamp(), ...(ach ? [buildAchievementEmbed(ach)] : [])] });
    },
  },

  // ── /creatorcode ─────────────────────────
  {
    data: new SlashCommandBuilder().setName("creatorcode").setDescription("Support a creator for a discount, or leave blank to remove.").addStringOption((o) => o.setName("code").setDescription("Creator code (leave blank to remove)").setRequired(false)),
    async execute(interaction) {
      const userId = interaction.user.id; addInteraction(userId);
      const rawInput = interaction.options.getString("code");
      if (!rawInput || rawInput.trim() === "") {
        const user = getUser(userId);
        if (!user.hasCreatorCode) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("ℹ️ No Creator Code Active").setDescription("Use `/creatorcode <code>` to support a creator and get a discount!").setColor(0x888888).setTimestamp()] }); return; }
        updateUser(userId, { hasCreatorCode: false, creatorDiscount: 0, freeSkinExpiry: 0, freeSkinRedeemed: false });
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Creator Code Removed").setDescription("Your creator code has been removed.").setColor(0xff6600).setTimestamp()] }); return;
      }
      const code = rawInput.toLowerCase().trim(); const match = VALID_CODES[code];
      if (!match) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❓ Unknown Creator Code").setDescription(`**${rawInput}** isn't a valid creator code. Try \`tylajadee\`, \`qckdream\`, or \`clovel\`!`).setColor(0xff6600).setTimestamp()] }); return; }
      const user = getUser(userId); const discountPct = Math.round(match.discount * 100);
      const updates = { hasCreatorCode: true, creatorDiscount: match.discount };
      if (match.freeSkin) { if (!((user.freeSkinExpiry ?? 0) > Date.now() && !(user.freeSkinRedeemed ?? false))) { updates.freeSkinExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; updates.freeSkinRedeemed = false; } }
      updateUser(userId, updates);
      let desc = `You're now supporting **${match.displayName}**! 🙌\n\nYou have a **${discountPct}% discount** on the Item Shop!\n\nAll \`/buy\` purchases are ${discountPct}% cheaper. 💙`;
      if (match.freeSkin) desc += `\n\n🎁 **Special Perk — Free Skin Week!**\nAs a ${match.displayName} supporter you get **one FREE skin** from the Item Shop!`;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎉 Creator Code Applied!").setDescription(desc).setColor(0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()] });
    },
  },

  // ── /zeropoint ───────────────────────────
  {
    data: new SlashCommandBuilder().setName("zeropoint").setDescription("Interact with the mysterious Zero Point orb..."),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const now = Date.now(), isCracked = (user.zeroPointCrackedUntil ?? 0) > now;
      const ZERO_POINT_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/a/a5/Zero_Point.png";
      const buildZPEmbed = (cracked) => {
        const minsLeft = Math.ceil(Math.max(0, (getUser(userId).zeroPointCrackedUntil ?? 0) - Date.now()) / 60000);
        const desc = cracked
          ? `⚡ *You feel an ominous crackle in the air...*\n\nThe Zero Point is **unstable**. Do not disturb it.\n\n> 🔴 **Interacting now may wipe some of your data.**\n\n⏳ The orb calms in **${minsLeft} minute${minsLeft !== 1 ? "s" : ""}**.\n\n⚠️ If you interact anyway:\n> • **80% chance** it takes **2 of your skins**\n> • **30% of your V-Bucks** drained (or -500 in debt)`
          : `*A mysterious orb with a menacing aura...*\n\n✨ **Donate a skin** — guaranteed weapon drop!\n> ⚡ SMGs & ARs: **30% chance for 25 ammo** — fire all at once!\n> 🔫 Other weapons: 1 ammo\n\n**Donate Founders Pack** — receive **2,500 V-Bucks** *(requires Founders Pack)*\n\n**Feed Luck Potion** — 50% chance to upgrade to Xtra Luck Potion\n**Feed Xtra Luck Potion** — 25% chance to upgrade to Godly Luck Potion`;
        return new EmbedBuilder().setTitle(cracked ? "⚡ The Zero Point is Cracking..." : "🔵 The Zero Point").setDescription(desc).setColor(cracked ? 0xff4444 : 0x4444ff).setImage(ZERO_POINT_IMAGE).setTimestamp();
      };
      const buildZPRow = (cracked) => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("zp_donate_skin").setLabel(cracked ? "⚠️ Donate Skin (RISKY)" : "🎮 Donate a Skin").setStyle(cracked ? ButtonStyle.Danger : ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("zp_donate_founders").setLabel(fu.hasFoundersPack ? "🌟 Donate Founders Pack (+2,500 V-Bucks)" : "🌟 Donate Founders Pack (Not Owned)").setStyle(fu.hasFoundersPack ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!fu.hasFoundersPack),
          new ButtonBuilder().setCustomId("zp_luck_potion").setLabel(fu.luckPotion > 0 ? `🍀 Feed Luck Potion (${fu.luckPotion})` : "🍀 Feed Luck Potion (None)").setStyle(ButtonStyle.Primary).setDisabled((fu.luckPotion ?? 0) === 0),
          new ButtonBuilder().setCustomId("zp_xtra_potion").setLabel(fu.xtraLuckPotion > 0 ? `🔮 Feed Xtra Potion (${fu.xtraLuckPotion})` : "🔮 Feed Xtra Potion (None)").setStyle(ButtonStyle.Primary).setDisabled((fu.xtraLuckPotion ?? 0) === 0)
        );
      };
      const msg = await interaction.reply({ embeds: [buildZPEmbed(isCracked)], components: [buildZPRow(isCracked)], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        collector.stop("interacted");
        const now2 = Date.now(); const cu = getUser(userId); const nowCracked = (cu.zeroPointCrackedUntil ?? 0) > now2;
        if (nowCracked && (btn.customId === "zp_donate_skin" || btn.customId === "zp_donate_founders")) {
          if (Math.random() < 0.8) {
            const entries = Object.entries(cu.inventoryNames); const toSteal = entries.slice(0, 2); const stolen = [];
            for (const [k] of toSteal) { const sid = k.replace(/_\d+$/, ""); const idx = cu.inventory.indexOf(sid); if (idx !== -1) cu.inventory.splice(idx, 1); stolen.push(cu.inventoryNames[k] ?? sid); delete cu.inventoryNames[k]; }
            const newVb = cu.vbucks <= 0 ? cu.vbucks - 500 : cu.vbucks - Math.floor(cu.vbucks * 0.3);
            updateUser(userId, { inventory: cu.inventory, inventoryNames: cu.inventoryNames, vbucks: newVb });
            await btn.update({ embeds: [new EmbedBuilder().setTitle("💥 The Zero Point Strikes Back!").setDescription(`You disturbed the cracked Zero Point!\n${stolen.length ? `👁️ It took: **${stolen.join("**, **")}**\n` : ""}${newVb < 0 ? `💸 You are now **${Math.abs(newVb).toLocaleString()} V-Bucks** in debt!\n` : `💸 Drained **30%** of your V-Bucks.\n`}\n💳 **Balance:** ${newVb.toLocaleString()} V-Bucks`).setColor(0xff0000).setImage(ZERO_POINT_IMAGE).setTimestamp()], components: [] });
          } else { await btn.update({ content: "The Zero Point crackled... nothing happened. Lucky.", embeds: [], components: [] }); }
          return;
        }
        const updatedTimes = [...(cu.zeroPointUseTimes ?? []).filter((t) => now2 - t < 5 * 60 * 1000), now2];
        updateUser(userId, { zeroPointUseTimes: updatedTimes });
        if (updatedTimes.length > 5) {
          updateUser(userId, { zeroPointCrackedUntil: now2 + 15 * 60 * 1000, zeroPointUseTimes: [] });
          await btn.update({ embeds: [new EmbedBuilder().setTitle("⚡ The Zero Point is CRACKING!").setDescription("You've interacted too many times.\n\n> ⚠️ **Wait 15 minutes. Interacting before then risks your skins and V-Bucks.**\n\nNothing happened this time.").setColor(0xff6600).setImage(ZERO_POINT_IMAGE).setTimestamp()], components: [] }); return;
        }
        if (btn.customId === "zp_luck_potion") {
          if ((cu.luckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { luckPotion: cu.luckPotion - 1 });
          if (roll(50)) { updateUser(userId, { xtraLuckPotion: (cu.xtraLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🌀 Zero Point — Success!").setDescription("The **Zero Point** crackled with energy! Your **Luck Potion** transformed into an **Xtra Luck Potion**! 🔮").setFooter({ text: "50% chance — you got lucky!" }).setTimestamp()], components: [] }); }
          else { await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Zero Point — Failed").setDescription("The **Zero Point** consumed your **Luck Potion**... but the transformation failed.").setFooter({ text: "50% chance — better luck next time!" }).setTimestamp()], components: [] }); }
          return;
        }
        if (btn.customId === "zp_xtra_potion") {
          if ((cu.xtraLuckPotion ?? 0) <= 0) { await btn.update({ content: "❌ No Xtra Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { xtraLuckPotion: cu.xtraLuckPotion - 1 });
          if (roll(25)) { updateUser(userId, { godlyLuckPotion: (cu.godlyLuckPotion ?? 0) + 1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⚡ Zero Point — GODLY SUCCESS!").setDescription("The **Zero Point** ERUPTED! Your **Xtra Luck Potion** ascended into a **Godly Luck Potion**! ⚡\n\nThis is extremely rare — treasure it!").setFooter({ text: "25% chance — incredible!" }).setTimestamp()], components: [] }); }
          else { await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Zero Point — Failed").setDescription("The **Zero Point** tried to ascend your **Xtra Luck Potion**... and failed.").setFooter({ text: "25% chance — keep trying!" }).setTimestamp()], components: [] }); }
          return;
        }
        if (btn.customId === "zp_donate_founders") {
          if (!cu.hasFoundersPack) { await btn.reply({ content: "❌ No Founders Pack!", ephemeral: true }); return; }
          updateUser(userId, { hasFoundersPack: false }); addVbucks(userId, 2500);
          const afterUser = getUser(userId);
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🌟 The Zero Point Accepts Your Offering!").setDescription(`You offered your **Founders Pack**.\n\nThe orb pulses with golden energy...\n\n💰 **+2,500 V-Bucks!**\n💳 **New balance:** ${afterUser.infiniteVbucks ? "∞" : afterUser.vbucks.toLocaleString()} V-Bucks\n\n*Your Founders Pack was consumed.*`).setColor(0xffd700).setImage(ZERO_POINT_IMAGE).setTimestamp()], components: [] }); return;
        }
        if (btn.customId === "zp_donate_skin") {
          const entries = Object.entries(cu.inventoryNames);
          if (!entries.length) { await btn.update({ content: "❌ You have no skins to donate!", embeds: [], components: [] }); return; }
          const skinOpts = entries.slice(0, 25).map(([k, n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
          const selectRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("zp_skin_select").setPlaceholder("Choose a skin to sacrifice...").addOptions(skinOpts));
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🔵 Choose Your Offering").setDescription("The Zero Point awaits.\n\n✅ You will **always** get a weapon.\n> ⚡ **SMGs & ARs** have **30%** chance for **25 ammo**\n> 🔫 Others come with **1 ammo**\n\nSelect a skin:").setColor(0x4444ff).setTimestamp()], components: [selectRow] });
          const skinCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId && i.customId === "zp_skin_select" });
          skinCol.on("collect", async (sel) => {
            skinCol.stop("selected");
            const key = sel.values[0]; const skinName = cu.inventoryNames[key] ?? key; const skinId = key.replace(/_\d+$/, "");
            const fu2 = getUser(userId); const idx = fu2.inventory.indexOf(skinId); if (idx !== -1) fu2.inventory.splice(idx, 1); delete fu2.inventoryNames[key];
            updateUser(userId, { inventory: fu2.inventory, inventoryNames: fu2.inventoryNames });
            const weapon = FORTNITE_WEAPONS[Math.floor(Math.random() * FORTNITE_WEAPONS.length)];
            const isMulti = isMultiAmmoWeapon(weapon); const getsMulti = isMulti && Math.random() < 0.3; const ammoCount = getsMulti ? 25 : 1;
            const fu3 = getUser(userId); updateUser(userId, { weapons: [...(fu3.weapons ?? []), ...Array(ammoCount).fill(weapon.name)] });
            const resultDesc = getsMulti
              ? `You sacrificed **${skinName}** to the Zero Point.\n\nThe orb erupts — it **liked** your offering.\n\n${weapon.emoji} **You received: ${weapon.name} × 25 ammo!**\n*"${weapon.description}"*\n\n⚡ Use \`/attack @user ${weapon.name}\` to fire **all 25 shots at once!**`
              : `You sacrificed **${skinName}** to the Zero Point.\n\n${weapon.emoji} **You received: ${weapon.name}** *(1 ammo)*\n*"${weapon.description}"*\n\nUse \`/attack @user ${weapon.name}\`!${isMulti ? "\n\n*Unlucky — could have been 25 ammo.*" : ""}`;
            await sel.update({ embeds: [new EmbedBuilder().setTitle(getsMulti ? `⚡ JACKPOT — ${weapon.name} × 25!` : `${weapon.emoji} The Zero Point Rewards You!`).setDescription(resultDesc).setColor(getsMulti ? 0xffd700 : 0x4444ff).setImage(ZERO_POINT_IMAGE).setTimestamp()], components: [] });
          });
          skinCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ The Zero Point lost interest.", embeds: [], components: [] }).catch(() => {}); });
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  // ── /attack ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("attack").setDescription("Attack another player with a weapon you own").addUserOption((o) => o.setName("target").setDescription("Player to attack").setRequired(true)).addStringOption((o) => o.setName("weapon").setDescription("Weapon to use (must be in your arsenal)").setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction) => {
      const userId = interaction.user.id; const user = getUser(userId);
      const focused = interaction.options.getFocused().toLowerCase();
      const weapons = [...(user.weapons ?? [])]; const unique = [...new Set(weapons)];
      const choices = unique.filter((w) => w.toLowerCase().includes(focused)).slice(0, 25).map((w) => {
        const ammo = weapons.filter((x) => x === w).length; const wi = getWeaponByName(w);
        return { name: `${w} — ${ammo} ammo${wi && isMultiAmmoWeapon(wi) && ammo > 1 ? " (fires all at once)" : ""}`, value: w };
      });
      await interaction.respond(choices);
    },
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("target", true); const weaponInput = interaction.options.getString("weapon", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't attack yourself." }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Bots have unlimited HP." }); return; }
      const user = getUser(userId); const weapons = [...(user.weapons ?? [])];
      const weaponName = weapons.find((w) => w.toLowerCase() === weaponInput.toLowerCase()) ?? null;
      if (!weaponName) { const owned = [...new Set(weapons)]; await interaction.editReply({ content: `❌ You don't have **${weaponInput}**.${owned.length ? `\n\n**Arsenal:** ${owned.join(", ")}` : "\n\n*No weapons. Use \`/zeropoint\` to get one.*"}` }); return; }
      const weaponInfo = getWeaponByName(weaponName); const emoji = weaponInfo?.emoji ?? "🔫"; const desc2 = weaponInfo?.description ?? "A powerful weapon."; const isMulti = weaponInfo ? isMultiAmmoWeapon(weaponInfo) : false;
      const ammoCount = weapons.filter((w) => w.toLowerCase() === weaponName.toLowerCase()).length; const usedAmmo = isMulti ? ammoCount : 1;
      const newWeapons = [...weapons]; let removed = 0;
      for (let i = newWeapons.length - 1; i >= 0 && removed < usedAmmo; i--) { if (newWeapons[i].toLowerCase() === weaponName.toLowerCase()) { newWeapons.splice(i, 1); removed++; } }
      updateUser(userId, { weapons: newWeapons });
      const HIT_CHANCE = 0.25;
      if (isMulti && usedAmmo > 1) {
        let hits = 0, misses = 0;
        for (let i = 0; i < usedAmmo; i++) { if (Math.random() < HIT_CHANCE) hits++; else misses++; }
        const lines = []; let hl = hits, ml = misses; const display = Math.min(usedAmmo, 20);
        for (let i = 0; i < display; i++) { const rem = display - i; const rollHit = hl > 0 && (ml === 0 || Math.random() < hl / rem); if (rollHit) { lines.push("💥 **HIT**"); hl--; } else { lines.push("💨 miss"); ml--; } }
        if (usedAmmo > 20) lines.push(`*...and ${usedAmmo - 20} more shots*`);
        if (hits > 0) {
          const elimMs = Math.min(hits * 10 * 60 * 1000, 120 * 60 * 1000); const existing = (getUser(target.id).eliminatedUntil ?? 0) > Date.now() ? getUser(target.id).eliminatedUntil : Date.now();
          updateUser(target.id, { eliminatedUntil: existing + elimMs }); const totalMins = Math.round(elimMs / 60000);
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} unloaded on ${target.username}!`).setDescription(`**${interaction.user.username}** fired **${usedAmmo} rounds** of **${weaponName}** at **${target.username}**!\n\n${lines.join("\n")}\n\n📊 **${hits} hit(s), ${misses} miss(es)** out of ${usedAmmo}\n\n☠️ **${target.username}** is **eliminated for ${totalMins} minutes!**\nSomeone can \`/reboot\` them for **299 V-Bucks**.\n\n🔫 All **${usedAmmo} ammo** consumed.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else { await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} missed every shot!`).setDescription(`Fired **${usedAmmo} rounds** at **${target.username}**...\n\n${lines.join("\n")}\n\n📊 **0 hits, ${misses} misses** — incredible aim.\n\n🔫 **${usedAmmo} ammo** wasted.`).setColor(0x888888).setThumbnail(target.displayAvatarURL()).setTimestamp()] }); }
      } else {
        const hit = Math.random() < HIT_CHANCE;
        if (hit) { updateUser(target.id, { eliminatedUntil: Date.now() + 10 * 60 * 1000 }); await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Direct Hit! ${interaction.user.username} → ${target.username}`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n💥 **ELIMINATED!**\n\n${target.username} can't buy or catch skins for **10 minutes**.\nSomeone can \`/reboot\` them for **299 V-Bucks**.\n\n🔫 **${weaponName}** consumed.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] }); }
        else { const missMessages = ["sprayed and missed every shot","forgot to take the safety off","tripped and fired into the ground","aimed for the head and hit a tree"]; const mm = missMessages[Math.floor(Math.random() * missMessages.length)]; await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Missed! ${interaction.user.username} → ${target.username}`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**...\n\n*"${desc2}"*\n\n💨 **MISSED!** ${interaction.user.username} ${mm}.\n\n${target.username} is fine. Ammo still consumed.\n\n🔫 **${weaponName}** consumed.`).setColor(0x888888).setThumbnail(target.displayAvatarURL()).setTimestamp()] }); }
      }
    },
  },

  // ── /reboot ──────────────────────────────
  {
    data: new SlashCommandBuilder().setName("reboot").setDescription("Reboot a downed player so they can buy and catch skins again").addUserOption((o) => o.setName("player").setDescription("Player to reboot").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.editReply({ content: "❌ Can't reboot a bot." }); return; }
      if (!isEliminated(target.id)) { await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Player is Alive").setDescription(`**${target.username}** is not downed!\n\n*No V-Bucks deducted.*`).setColor(0x00ff00).setThumbnail(target.displayAvatarURL()).setTimestamp()] }); return; }
      const cu = getUser(userId);
      if (!cu.infiniteVbucks && cu.vbucks < 299) { await interaction.editReply({ content: `❌ Need **299 V-Bucks** to reboot, you only have **${cu.vbucks.toLocaleString()}**.` }); return; }
      if (!cu.infiniteVbucks) addVbucks(userId, -299);
      updateUser(target.id, { eliminatedUntil: 0 });
      const after = getUser(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Player Rebooted!").setDescription(`**${interaction.user.username}** spent **299 V-Bucks** to reboot **${target.username}**!\n\n${target.username} is back and can catch skins again.\n\n💳 **Your balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
    },
  },

  // ── /useluckpotion ───────────────────────
  {
    data: new SlashCommandBuilder().setName("useluckpotion").setDescription("Use a luck potion to boost your chances!").addStringOption((o) => o.setName("type").setDescription("Which luck potion?").setRequired(true).addChoices({ name: "🍀 Luck Potion (+15%)", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion (+40%)", value: "xtraLuckPotion" }, { name: "⚡ Godly Luck Potion (+80%)", value: "godlyLuckPotion" })),
    async execute(interaction) {
      const type = interaction.options.getString("type");
      const player = getUser(interaction.user.id);
      if ((player[type] ?? 0) <= 0) { const names = { luckPotion: "Luck Potion", xtraLuckPotion: "Xtra Luck Potion", godlyLuckPotion: "Godly Luck Potion" }; await interaction.reply({ content: `❌ You don't have any **${names[type]}**!`, ephemeral: true }); return; }
      player[type]--;
      const luckKey = type === "luckPotion" ? "normal" : type === "xtraLuckPotion" ? "xtra" : "godly";
      player.activeLuck = luckKey;
      const INFO = { normal: { emoji: "🍀", label: "Luck Potion", boost: "+15%", color: "#2ecc71" }, xtra: { emoji: "🔮", label: "Xtra Luck Potion", boost: "+40%", color: "#9b59b6" }, godly: { emoji: "⚡", label: "Godly Luck Potion", boost: "+80%", color: "#f1c40f" } };
      const info = INFO[luckKey];
      const embed = new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} ${info.label} Activated!`).setDescription(`All luck-based chances boosted by **${info.boost}**!`).addFields({ name: "God Chest Chance", value: `${boostedChance(5, luckKey)}%`, inline: true }, { name: "Inf V-Bucks Chance", value: `${boostedChance(15, luckKey)}%`, inline: true }, { name: "10k V-Bucks Chance", value: `${boostedChance(25, luckKey)}%`, inline: true }).setFooter({ text: "Fortnite Bot — Active luck effect applied" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ── /skinalogue ──────────────────────────
  {
    data: new SlashCommandBuilder().setName("skinalogue").setDescription("Browse all catchable Fortnite skins with spawn percentages").addStringOption((o) => o.setName("search").setDescription("Filter by name").setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply();
      const query = (interaction.options.getString("search") ?? "").trim().toLowerCase();
      const allSkins = await fetchFortniteSkins();
      const filtered = query ? allSkins.filter((s) => s.name.toLowerCase().includes(query)) : allSkins;
      let page = 0; const PAGE_SIZE = 8;
      const buildSkinPage = (p) => {
        const total = filtered.length; const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE)); const safePage = Math.min(p, totalPages - 1);
        const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
        const desc2 = total === 0 ? `No skins found for **"${query}"**.` : slice.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · *${s.rarity}* · \`${getSpawnPercent(s.rarity)}%\` spawn`).join("\n");
        const embed = new EmbedBuilder().setTitle(query ? `📖 Skinalogue — "${query}"` : "📖 Skinalogue — All Skins").setDescription(desc2).setColor(0x00d4ff).setFooter({ text: total === 0 ? "No results" : `Page ${safePage + 1} of ${totalPages} • ${total} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`skin_prev_${safePage}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0 || total === 0), new ButtonBuilder().setCustomId(`skin_next_${safePage}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1 || total === 0));
        return { embed, row, totalPages, safePage };
      };
      const { embed, row } = buildSkinPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      if (!filtered.length) return;
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000, filter: (b) => b.user.id === interaction.user.id });
      collector.on("collect", async (btn) => {
        const { totalPages } = buildSkinPage(page);
        if (btn.customId.startsWith("skin_prev")) page = Math.max(0, page - 1); else page = Math.min(totalPages - 1, page + 1);
        const { embed: e, row: r } = buildSkinPage(page);
        await btn.update({ embeds: [e], components: [r] });
      });
      collector.on("end", async () => { const { embed: e } = buildSkinPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },
];

// ─────────────────────────────────────────────
//  Command registration & Discord client
// ─────────────────────────────────────────────
const commandMap = new Map(commands.map((c) => [c.data.name, c]));

async function registerCommands(token, clientId, guildId) {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const body = commands.map((c) => c.data.toJSON());
    if (guildId) { await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body }); console.log(`✅ Registered ${body.length} guild commands`); }
    else { await rest.put(Routes.applicationCommands(clientId), { body }); console.log(`✅ Registered ${body.length} global commands`); }
  } catch (err) { console.error("❌ Command registration failed:", err.message); }
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
    if (interaction.isAutocomplete()) {
      const cmd = commandMap.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction);
      return;
    }
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
if (token) {
  client.login(token).catch((err) => console.error("❌ Discord login failed:", err.message));
} else {
  console.warn("⚠️ No DISCORD_TOKEN set — Express server is running but bot is offline.");
}

process.on("SIGTERM", () => { client.destroy(); process.exit(0); });
