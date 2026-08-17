const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const economy = require('../../features/economy');
const { formatNumber, randomInt, sample } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

/** 取得貨幣符號 */
async function currency(client, guildId) {
  const s = await client.settings.get(guildId);
  return s.economy.currency || '🪙';
}

/** 檢查餘額並扣除賭注；失敗回傳 { ok:false, reason } */
async function placeBet(interaction, client, bet) {
  if (bet <= 0) return { ok: false, reason: t('下注金額必須大於 0！', 'Bet must be greater than 0!') };
  const profile = await economy.getProfile(client, interaction.guild.id, interaction.user.id);
  if ((profile.wallet || 0) < bet) return { ok: false, reason: t('你的餘額不足！', 'Insufficient balance!') };
  await economy.addMoney(client, interaction.guild.id, interaction.user.id, -bet);
  return { ok: true };
}

/** 正面/反面的顯示翻譯（不影響遊戲邏輯的值） */
const faceLabel = (v) => (v === '正面' ? t('正面', 'Heads') : t('反面', 'Tails'));

/** 老虎機賠率：💎×3 為 10 倍、三同 ×5、兩同 ×2、其餘 0 */
function slotsMultiplier(symbols) {
  const [a, b, c] = symbols;
  if (a === b && b === c) return a === '💎' ? 10 : 5;
  if (a === b || b === c || a === c) return 2;
  return 0;
}

const SLOT_SYMBOLS = ['🍒', '🍋', '🍇', '💎', '7️⃣'];

module.exports = [
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('coinflip')
      .setDescription(t('擲硬幣賭博，猜中贏 2 倍', 'Coin flip gambling, win 2x if you guess right'))
      .setDMPermission(false)
      .addIntegerOption((o) => o.setName('bet').setDescription(t('下注金額', 'Bet amount')).setMinValue(1).setRequired(true))
      .addStringOption((o) =>
        o.setName('choice').setDescription(t('你的選擇（不選則自動猜一個）', 'Your choice (auto-picks if empty)')).addChoices(
          { name: t('正面', 'Heads'), value: '正面' },
          { name: t('反面', 'Tails'), value: '反面' }
        )
      ),
    cooldown: 3000,
    async run(interaction, client) {
      const bet = interaction.options.getInteger('bet');
      const placed = await placeBet(interaction, client, bet);
      if (!placed.ok) return sendError(interaction, placed.reason);

      let choice = interaction.options.getString('choice');
      if (!choice) choice = Math.random() < 0.5 ? '正面' : '反面';
      const result = Math.random() < 0.5 ? '正面' : '反面';
      const won = choice === result;
      const cur = await currency(client, interaction.guild.id);

      if (won) {
        const prize = bet * 2;
        await economy.addMoney(client, interaction.guild.id, interaction.user.id, prize);
        return sendSuccess(interaction, t(`你猜了 **${choice}**，結果是 **${result}**！\n🎉 你贏得了 ${cur} **${formatNumber(prize)}**！`, `You guessed **${faceLabel(choice)}**, the result was **${faceLabel(result)}**!\n🎉 You won ${cur} **${formatNumber(prize)}**!`));
      }
      return sendError(interaction, t(`你猜了 **${choice}**，結果是 **${result}**。\n😢 你輸掉了 ${cur} **${formatNumber(bet)}**。`, `You guessed **${faceLabel(choice)}**, the result was **${faceLabel(result)}**.\n😢 You lost ${cur} **${formatNumber(bet)}**.`));
    },
  },
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('diceduel')
      .setDescription(t('賭骰子：猜中數字贏 5 倍', 'Dice duel: guess the number to win 5x'))
      .setDMPermission(false)
      .addIntegerOption((o) => o.setName('bet').setDescription(t('下注金額', 'Bet amount')).setMinValue(1).setRequired(true))
      .addIntegerOption((o) => o.setName('number').setDescription(t('猜的數字（1-6，不選則自動猜一個）', 'Guess (1-6, auto if empty)')).setMinValue(1).setMaxValue(6)),
    cooldown: 3000,
    async run(interaction, client) {
      const bet = interaction.options.getInteger('bet');
      const placed = await placeBet(interaction, client, bet);
      if (!placed.ok) return sendError(interaction, placed.reason);

      let guess = interaction.options.getInteger('number');
      if (!guess) guess = randomInt(1, 6);
      const roll = randomInt(1, 6);
      const won = guess === roll;
      const cur = await currency(client, interaction.guild.id);

      if (won) {
        const prize = bet * 5;
        await economy.addMoney(client, interaction.guild.id, interaction.user.id, prize);
        return sendSuccess(interaction, t(`你猜了 **${guess}**，骰子擲出 **${roll}**！\n🎉 你贏得了 ${cur} **${formatNumber(prize)}**！`, `You guessed **${guess}**, the dice rolled **${roll}**!\n🎉 You won ${cur} **${formatNumber(prize)}**!`));
      }
      return sendError(interaction, t(`你猜了 **${guess}**，骰子擲出 **${roll}**。\n😢 你輸掉了 ${cur} **${formatNumber(bet)}**。`, `You guessed **${guess}**, the dice rolled **${roll}**.\n😢 You lost ${cur} **${formatNumber(bet)}**.`));
    },
  },
  {
    category: 'economy',
    data: new SlashCommandBuilder()
      .setName('slots')
      .setDescription(t('老虎機賭博，三同 ×5、兩同 ×2、💎×3 ×10', 'Slot machine: 3 same ×5, 2 same ×2, 💎×3 ×10'))
      .setDMPermission(false)
      .addIntegerOption((o) => o.setName('bet').setDescription(t('下注金額', 'Bet amount')).setMinValue(1).setRequired(true)),
    cooldown: 3000,
    async run(interaction, client) {
      const bet = interaction.options.getInteger('bet');
      const placed = await placeBet(interaction, client, bet);
      if (!placed.ok) return sendError(interaction, placed.reason);

      const symbols = [sample(SLOT_SYMBOLS), sample(SLOT_SYMBOLS), sample(SLOT_SYMBOLS)];
      const mult = slotsMultiplier(symbols);
      const cur = await currency(client, interaction.guild.id);
      const line = symbols.join(' ');

      if (mult > 0) {
        const prize = bet * mult;
        await economy.addMoney(client, interaction.guild.id, interaction.user.id, prize);
        return sendSuccess(interaction, t(`${line}\n🎉 中了 **${mult} 倍**！你贏得了 ${cur} **${formatNumber(prize)}**！`, `${line}\n🎉 **${mult}x**! You won ${cur} **${formatNumber(prize)}**!`));
      }
      return sendError(interaction, t(`${line}\n😢 沒中獎，你輸掉了 ${cur} **${formatNumber(bet)}**。`, `${line}\n😢 No win, you lost ${cur} **${formatNumber(bet)}**.`));
    },
  },
];
