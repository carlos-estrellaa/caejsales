const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');

// Replace these with your actual Telegram bot token and chat ID
const TELEGRAM_BOT_TOKEN = '8097833211:AAEBnZT7NoDDQTGNsWCpY7MQ0cUO-PCZF3Q';
const TELEGRAM_CHAT_ID = '1266169467';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
let lastSalesSent = null;

async function sendToTelegram(sale) {
  let message = `🔥 Nova Promoção!\n\n${sale.description}\n\n💰 Preço: ${sale.price}\n\n🔗 Link: ${sale.link}`;
  message = sale.comment ? `${message}\n\n${sale.comment}` : message;

  try {
    // First send the image if available
    if (sale.imageUrl) {
      await bot.sendPhoto(TELEGRAM_CHAT_ID, sale.imageUrl, { caption: message });
    } else {
      await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    }
  } catch (error) {
    console.error('Error sending to Telegram:', error.message);
  }
}

async function scrapeGatry() {
  const sales = [];
  try {
    const response = await axios.get('https://gatry.com/');
    const $ = cheerio.load(response.data);
    let foundSale = false

    // Find the promotions section and get all articles within it
    $('.promotions.row article').each((index, article) => {
      // Skip first two because it's latest comments
      if (index < 2 || foundSale) return;

      const description = $(article).find('.description h3 a').text();
      const link = $(article).find('.image a').attr('href');

      // Check if the sale is older than the last one sent
      if (lastSalesSent) {
        if (lastSalesSent.description === description && lastSalesSent.link === link) {
          foundSale = true;
          return;
        }
      }


      const imageUrl = $(article).find('.image a img').attr('src');
      const price = $(article).find('.price').text().replace('\n', '').trim();
      const comment = $(article).find('.description .comment');
      const user = $(article).find('.option-other a').attr('href');
      const commentsLink = `https://gatry.com${$(article).find('.option-more a').attr('href')}`;

      sales.push({
        description,
        link,
        imageUrl,
        price,
        comment: comment.length ? comment : undefined,
        user,
        commentsLink
      });
    });

    if (sales.length === 0) {
      console.log('No new sales found.');
      return;
    }

    console.log('New sales found:', sales);

    // Send each new sale to Telegram
    if (!lastSalesSent) {
      // Check if the sale has a comment
      if (sales[0].comment) {
        const commentsLink = sales[0].commentsLink;
        const user = sales[0].user;
        const comment = getComment(commentsLink, user);
        sales[0].comment = comment;
      }

      await sendToTelegram(sales[0]);
      lastSalesSent = sales[0];
      return;
    }

    lastSalesSent = sales[0];

    for (const sale of sales.reverse()) {
      // Check if the sale has a comment
      if (sale.comment) {
        const commentsLink = sale.commentsLink;
        const user = sale.user;
        const comment = getComment(commentsLink, user);
        sale.comment = comment;
      }
      await sendToTelegram(sale);
    }
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
}

const getComment = async (commentsLink, user) => {
  const response = await axios.get(commentsLink);
  const $ = cheerio.load(response.data);
  const comments = $('.comment');
  const commentUser = comments[0].find('.comment-header a')[0].attr('href');

  if (commentUser === user) {
    return comments[0].find('.comment-content p').text();
  } else {
    return undefined;
  }
}

// Run the scraping function every 1 minute
setInterval(scrapeGatry, 60000);

// Run it once immediately
scrapeGatry();
