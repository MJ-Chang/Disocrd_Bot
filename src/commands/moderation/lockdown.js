const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendError, sendSuccess } = require('../../utils/embeds');
const { requireBotPerm } = require('../../core/permissions');
const { logModAction } = require('../../features/moderation');
const { t } = require('../../utils/i18n');

module.exports = {
  category: 'moderation',
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription(t('鎖定或解鎖頻道', 'Lock or unlock a channel'))
    .addSubcommand((sc) =>
      sc
        .setName('on')
        .setDescription(t('鎖定頻道，禁止 @everyone 發言', 'Lock channel, block @everyone from sending'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('要鎖定的頻道（預設為目前頻道）', 'Channel to lock (default: current)')))
    )
    .addSubcommand((sc) =>
      sc
        .setName('off')
        .setDescription(t('解除頻道鎖定', 'Unlock the channel'))
        .addChannelOption((o) => o.setName('channel').setDescription(t('要解鎖的頻道（預設為目前頻道）', 'Channel to unlock (default: current)')))
    ),
  modOnly: true,
  async run(interaction, client) {
    if (!(await requireBotPerm(interaction, PermissionFlagsBits.ManageChannels, t('❌ 機器人缺少「管理頻道」權限。', "❌ Missing 'Manage Channels' permission.")))) return;

    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel.isTextBased()) return sendError(interaction, t('此指令僅支援文字類頻道。', 'This command only works on text channels.'));

    const everyone = interaction.guild.roles.everyone;
    const reason = sub === 'on' ? t('鎖定頻道（lockdown on）', 'Lock channel (lockdown on)') : t('解除鎖定（lockdown off）', 'Unlock channel (lockdown off)');
    try {
      if (sub === 'on') {
        await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason });
      } else {
        await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason });
      }
    } catch (e) {
      return sendError(
        interaction,
        t(`${sub === 'on' ? '鎖定' : '解鎖'}頻道失敗，請確認機器人權限。`, `${sub === 'on' ? 'Locking' : 'Unlocking'} the channel failed. Check bot permissions.`)
      );
    }

    await logModAction(
      client,
      interaction.guild,
      sub === 'on' ? t('鎖定頻道（lockdown on）', 'Lock channel (lockdown on)') : t('解除鎖定（lockdown off）', 'Unlock channel (lockdown off)'),
      { id: channel.id, name: `#${channel.name}` },
      interaction.member,
      t(`頻道：${channel.name}`, `Channel: ${channel.name}`)
    );
    return sendSuccess(
      interaction,
      sub === 'on'
        ? t(`🔒 已鎖定 **${channel.name}**，@everyone 暫時無法發言。`, `🔒 Locked **${channel.name}**. @everyone can't send messages for now.`)
        : t(`🔓 已解除 **${channel.name}** 的鎖定，成員可正常發言。`, `🔓 Unlocked **${channel.name}**. Members can send messages again.`)
    );
  },
};
