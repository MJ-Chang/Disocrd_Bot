const { SlashCommandBuilder } = require('discord.js');
const { t } = require('../../utils/i18n');
const { formatNumber } = require('../../utils/format');
const { sendError, sendSuccess } = require('../../utils/embeds');

module.exports = {
  category: 'leveling',
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('leveling')
    .setDescription(t('等級系統管理（管理員）', 'Leveling admin (admin only)'))
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('enable').setDescription(t('啟用等級系統', 'Enable leveling')))
    .addSubcommand((sub) => sub.setName('disable').setDescription(t('停用等級系統', 'Disable leveling')))
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription(t('設定升級公告頻道（不填則改用 DM）', 'Set level-up announce channel (DM if empty)'))
        .addChannelOption((o) => o.setName('announcechannel').setDescription(t('公告頻道', 'Announcement channel')))
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription(t('開啟或關閉升級公告', 'Toggle level-up announcements'))
        .addBooleanOption((o) => o.setName('on').setDescription(t('是否開啟', 'Enabled?')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('role-add')
        .setDescription(t('設定達指定等級時贈送的身分組', 'Set a role reward for reaching a level'))
        .addIntegerOption((o) => o.setName('level').setDescription(t('等級', 'Level')).setMinValue(1).setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription(t('身分組', 'Role')).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('role-remove')
        .setDescription(t('移除指定等級的身分組獎勵', 'Remove a level role reward'))
        .addIntegerOption((o) => o.setName('level').setDescription(t('等級', 'Level')).setMinValue(1).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('xp-set')
        .setDescription(t('設定成員的經驗值', "Set a member's XP"))
        .addUserOption((o) => o.setName('user').setDescription(t('目標成員', 'Target member')).setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription(t('經驗值', 'XP amount')).setMinValue(0).setRequired(true))
    ),
  cooldown: 3000,
  async run(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'enable') {
      await client.settings.set(guildId, 'leveling.enabled', true);
      return sendSuccess(interaction, t('等級系統已啟用！', 'Leveling enabled!'));
    }

    if (sub === 'disable') {
      await client.settings.set(guildId, 'leveling.enabled', false);
      return sendSuccess(interaction, t('等級系統已停用！', 'Leveling disabled!'));
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('announcechannel');
      await client.settings.set(guildId, 'leveling.channel', channel ? channel.id : null);
      return sendSuccess(
        interaction,
        t(
          channel ? `已設定升級公告頻道為 <#${channel.id}>！` : '已清除公告頻道，升級訊息將改為 DM 發送。',
          channel ? `Announcement channel set to <#${channel.id}>!` : 'Cleared announcement channel; level-ups will be sent via DM.'
        )
      );
    }

    if (sub === 'announce') {
      const on = interaction.options.getBoolean('on');
      await client.settings.set(guildId, 'leveling.announce', on);
      return sendSuccess(interaction, t(on ? '升級公告已開啟！' : '升級公告已關閉！', on ? 'Level-up announcements enabled!' : 'Level-up announcements disabled!'));
    }

    if (sub === 'role-add') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      await client.settings.update(guildId, (s) => {
        if (!s.leveling.roles || typeof s.leveling.roles !== 'object') s.leveling.roles = {};
        s.leveling.roles[level] = role.id;
      });
      return sendSuccess(interaction, t(`已設定 **${level} 級** 獎勵身分組：${role}！`, `Set **level ${level}** reward role: ${role}!`));
    }

    if (sub === 'role-remove') {
      const level = interaction.options.getInteger('level');
      let existed = false;
      await client.settings.update(guildId, (s) => {
        if (s.leveling.roles && Object.prototype.hasOwnProperty.call(s.leveling.roles, level)) {
          delete s.leveling.roles[level];
          existed = true;
        }
      });
      if (!existed) return sendError(interaction, t(`**${level} 級** 沒有設定身分組獎勵。`, `No role reward set for **level ${level}**.`));
      return sendSuccess(interaction, t(`已移除 **${level} 級** 的身分組獎勵！`, `Removed the **level ${level}** role reward!`));
    }

    if (sub === 'xp-set') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const col = client.db.collection('levels');
      const k = `${guildId}:${target.id}`;
      const cur = col.get(k) || { xp: 0, level: 0, lastMessage: 0 };
      cur.xp = amount;
      cur.level = Math.floor(Math.sqrt(amount / 50));
      col.set(k, cur);
      return sendSuccess(interaction, t(`已將 ${target} 的經驗值設為 **${formatNumber(amount)}**（Lv. ${cur.level}）！`, `Set ${target}'s XP to **${formatNumber(amount)}** (Lv. ${cur.level})!`));
    }

    return sendError(interaction, t('未知的子指令。', 'Unknown subcommand.'));
  },
};
