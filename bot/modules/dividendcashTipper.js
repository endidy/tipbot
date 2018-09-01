'use strict';
const bitcoin = require('bitcoin');
let Regex = require('regex'),
  config = require('config'),
  spamchannels = config.get('moderation').botspamchannels;
let walletConfig = config.get('dividendcash').config;
let paytxfee = config.get('dividendcash').paytxfee;
const dividendcash = new bitcoin.Client(walletConfig);
exports.commands = ['tipdividendcash'];
exports.tipdividendcash = {
  usage: '<subcommand>',
  description:
    '__**Dividendcash Tipper**__\nTransaction Fees: **' + paytxfee + '**\n    **$tiphelp** : Displays This Message\n    **$tip balance** : get your balance\n    **$tip deposit** : get address for your deposits\n    **$tip withdraw <ADDRESS> <AMOUNT>** : withdraw coins to specified address\n    **$tip <@user> <amount>** :mention a user with @ and then the amount to tip them\n    **$tip private <user> <amount>** : put private before Mentioning a user to tip them privately.\n\n    has a default txfee of ' + paytxfee,
  process: async function(bot, msg, suffix) {
    let tipper = msg.author.id.replace('$', ''),
      words = msg.content
        .trim()
        .split(' ')
        .filter(function(n) {
          return n !== '';
        }),
      subcommand = words.length >= 2 ? words[1] : 'help',
      helpmsg =
        '__**Dividendcash Tipper**__\nTransaction Fees: **' + paytxfee + '**\n    **$tiphelp** : Displays This Message\n    **$tip balance** : get your balance\n    **$tip deposit** : get address for your deposits\n    **$tip withdraw <ADDRESS> <AMOUNT>** : withdraw coins to specified address\n    **$tip <@user> <amount>** :mention a user with @ and then the amount to tip them\n    **$tip private <user> <amount>** : put private before Mentioning a user to tip them privately.\n\n    **<> : Replace with appropriate value.**',
      channelwarning = 'Please use <#tipping-room> or DMs to talk to bots.';
    switch (subcommand) {
      case 'help':
        privateorSpamChannel(msg, channelwarning, doHelp, [helpmsg]);
        break;
      case 'balance':
        doBalance(msg, tipper);
        break;
      case 'deposit':
        privateorSpamChannel(msg, channelwarning, doDeposit, [tipper]);
        break;
      case 'withdraw':
        privateorSpamChannel(msg, channelwarning, doWithdraw, [tipper, words, helpmsg]);
        break;
      default:
        doTip(bot, msg, tipper, words, helpmsg);
    }
  }
};
function privateorSpamChannel(message, wrongchannelmsg, fn, args) {
  if (!inPrivateorSpamChannel(message)) {
    message.reply(wrongchannelmsg);
    return;
  }
  fn.apply(null, [message, ...args]);
}
function doHelp(message, helpmsg) {
  message.author.send(helpmsg);
}
function doBalance(message, tipper) {
  dividendcash.getBalance(tipper, 1, function(err, balance) {
    if (err) {
      message.reply('Error getting Dividendcash (DVD) balance.').then(message => message.delete(10000));
    } else {
    message.channel.send({ embed: {
    title: '**:gem:  Dividendcash Balance!  :gem:**',
    color: 8388736,
    fields: [
      {
        name: '__User__',
        value: '<@' + message.author.id + '>',
        inline: false
      },
      {
        name: '__Balance__',
        value: '**' + balance.toString() + '**',
        inline: false
      }
    ]
  } });
    }
  });
}
function doDeposit(message, tipper) {
  getAddress(tipper, function(err, address) {
    if (err) {
      message.reply('Error getting your Dividendcash deposit address.').then(message => message.delete(10000));
    } else {
    message.channel.send({ embed: {
    title: '**:rocket: Dividendcash Address! :rocket:**',
    color: 8388736,
    fields: [
      {
        name: '__User__',
        value: '<@' + message.author.id + '>',
        inline: false
      },
      {
        name: '__Address__',
        value: '**' + address + '**',
        inline: false
      }
    ]
  } });
    }
  });
}
function doWithdraw(message, tipper, words, helpmsg) {
  if (words.length < 4) {
    doHelp(message, helpmsg);
    return;
  }
  var address = words[2],
    amount = getValidatedAmount(words[3]);
  if (amount === null) {
    message.reply("I don't know how to withdraw that much Dividendcash (DVD)...").then(message => message.delete(10000));
    return;
  }
  dividendcash.getBalance(tipper, 1, function(err, balance) {
    if (err) {
      message.reply('Error getting Dividendcash (DVD) balance.').then(message => message.delete(10000));
    } else {
      if (Number(amount) + Number(paytxfee) > Number(balance)) {
        message.channel.send('Please leave atleast ' + paytxfee + ' Dividendcash (DVD) for transaction fees!');
        return;
      }
      dividendcash.sendFrom(tipper, address, Number(amount), function(err, txId) {
        if (err) {
          message.reply(err.message).then(message => message.delete(10000));
        } else {
        message.channel.send("**:strawberry: Dividendcash Transaction Completed! :strawberry:**\n" +  '<@' + message.author.id + '>' + ' just tipped '+ '<@' + recipient + '>' + ' for ' +  '**' + amount.toString() + '**' + ' DVD (fee: ' +  paytxfee.toString() + ')');
      }
    });
    }
  });
}
function doTip(bot, message, tipper, words, helpmsg) {
  if (words.length < 3 || !words) {
    doHelp(message, helpmsg);
    return;
  }
  var prv = false;
  var amountOffset = 2;
  if (words.length >= 4 && words[1] === 'private') {
    prv = true;
    amountOffset = 3;
  }
  let amount = getValidatedAmount(words[amountOffset]);
  if (amount === null) {
    message.reply("I don't know how to tip that much Dividendcash...").then(message => message.delete(10000));
    return;
  }
  dividendcash.getBalance(tipper, 1, function(err, balance) {
    if (err) {
      message.reply('Error getting Dividendcash balance.').then(message => message.delete(10000));
    } else {
      if (Number(amount) + Number(paytxfee) > Number(balance)) {
        message.channel.send('Please leave atleast ' + paytxfee + ' Dividendcash for transaction fees!');
        return;
      }
      if (!message.mentions.users.first()){
           message
            .reply('Sorry, I could not find a user in your tip...')
            .then(message => message.delete(10000));
            return;
          }
      if (message.mentions.users.first().id) {
        sendDVD(bot, message, tipper, message.mentions.users.first().id.replace('!', ''), amount, prv);
      } else {
        message.reply('Sorry, I could not find a user in your tip...').then(message => message.delete(10000));
      }
    }
  });
}
function sendDVD(bot, message, tipper, recipient, amount, privacyFlag) {
  getAddress(recipient.toString(), function(err, address) {
    if (err) {
      message.reply(err.message).then(message => message.delete(10000));
    } else {
          dividendcash.sendFrom(tipper, address, Number(amount), 1, null, null, function(err, txId) {
              if (err) {
                message.reply(err.message).then(message => message.delete(10000));
              } else {
                if (privacyFlag) {
                  let userProfile = message.guild.members.find('id', recipient);
                  userProfile.user.send("**:strawberry: Dividendcash Transaction Completed! :strawberry:**\n" +  '<@' + message.author.id + '>' + ' just tipped '+ '<@' + recipient + '>' + ' for ' +  '**' + amount.toString() + '**' + ' DVD (fee: ' +  paytxfee.toString() + ')');
                message.author.send("**:strawberry: Dividendcash Transaction Completed! :strawberry:**\n" +  '<@' + message.author.id + '>' + ' just tipped '+ '<@' + recipient + '>' + ' for ' +  '**' + amount.toString() + '**' + ' DVD (fee: ' +  paytxfee.toString() + ')');
                  if (
                    message.content.startsWith('$tip private ')
                  ) {
                    message.delete(1000); //Supposed to delete message
                  }
                } else {
                  message.channel.send("**:strawberry: Dividendcash Transaction Completed! :strawberry:**\n" +  '<@' + message.author.id + '>' + ' just tipped '+ '<@' + recipient + '>' + ' for ' +  '**' + amount.toString() + '**' + ' DVD (fee: ' +  paytxfee.toString() + ')');
                }
              }
            });
    }
  });
}
function getAddress(userId, cb) {
  dividendcash.getAddressesByAccount(userId, function(err, addresses) {
    if (err) {
      cb(err);
    } else if (addresses.length > 0) {
      cb(null, addresses[0]);
    } else {
      dividendcash.getNewAddress(userId, function(err, address) {
        if (err) {
          cb(err);
        } else {
          cb(null, address);
        }
      });
    }
  });
}
function inPrivateorSpamChannel(msg) {
  if (msg.channel.type == 'dm' || isSpam(msg)) {
    return true;
  } else {
    return false;
  }
}
function isSpam(msg) {
  return spamchannels.includes(msg.channel.id);
};
function getValidatedAmount(amount) {
  amount = amount.trim();
  if (amount.toLowerCase().endsWith('dividendcash')) {
    amount = amount.substring(0, amount.length - 3);
  }
  return amount.match(/^[0-9]+(\.[0-9]+)?$/) ? amount : null;
}
function txLink(txId) {
  return 'http://explorer.dividend.cash/tx/' + txId;
}
function addyLink(address) {
  return 'http://explorer.dividend.cash/address/' + address;
}
