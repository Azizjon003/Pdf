const { Telegraf, Composer, session, Scenes } = require("telegraf");
const { Sequelize } = require("sequelize");
const axios = require("axios");
const fs = require("fs");
const dotenv = require("dotenv");
const imgToPDF = require("image-to-pdf");

dotenv.config({ path: "config.env" });

require("./model");

const db = require("./model/index");
const path = require("path");
const { setTimeout } = require("timers/promises");
const User = db.user;
const TOKEN = String(process.env.TOKEN);

const bot = new Telegraf(TOKEN);

const newWizart = new Composer();

newWizart.hears("Yes ✅", (ctx) => {
  const id = ctx.update.message.from.id;
  const text = "Siz rasmlaringizni yuboring";
  ctx.telegram.sendMessage(id, text);
  return ctx.wizard.next();
});
newWizart.hears("No ❌", (ctx) => {
  const id = ctx.update.message.from.id;
  const text = "Siz botdan foydalanmadingiz";
  ctx.telegram.sendMessage(id, text);
});
const photoAdd = new Composer();

photoAdd.on("photo", async (ctx) => {
  let pages;
  const id = await ctx.update.message.from.id;
  const user = await User.findOne({ where: { telegramId: id } });
  const time = new Date().getTime();
  console.log(time);
  const photo = ctx.message.photo[2].file_id;
  // await ctx.telegram.sendPhoto(id, photo);
  const image = await bot.telegram.getFileLink(photo);

  await User.update(
    {
      images: Sequelize.fn("array_append", Sequelize.col("images"), time),
    },
    {
      where: {
        telegramId: id,
      },
    }
  );
  const data = await axios.get(image.href, { responseType: "stream" });

  await data.data.pipe(fs.createWriteStream(`${__dirname}/temp/${time}.jpg`));
  const text = "Rasm qabul qilindi.Rasmlar ning nomini kiriting.";
  await ctx.telegram.sendMessage(id, text);

  // return ctx.scene.leave();
});

photoAdd.on("text", async (ctx) => {
  const id = ctx.update.message.from.id;
  const txt = ctx.update.message.text;
  const text = "Rasmlar nomi qabul qilindi";
  const userData = await User.findOne({ where: { telegramId: id } });
  let pages = userData.images;
  if (!pages[0]) {
    return await ctx.telegram.sendMessage(id, "Rasmlar mavjud emas");
  }
  let pagesSort = pages.sort(function (a, b) {
    return a - b;
  });
  console.log(pagesSort);
  pages = [];
  pagesSort.forEach((el) => {
    pages.push(`${__dirname}/temp/${el}.jpg`);
  });
  console.log(pages);
  await User.update(
    {
      images: [],
    },
    {
      where: { telegramId: id },
    }
  );
  ctx.telegram.sendMessage(id, text);
  await imgToPDF(pages, "A4").pipe(fs.createWriteStream(`./${txt}.pdf`));

  await axios.get("http://magicsoft.uz/");

  const data = fs.readFileSync(path.join(__dirname, `${txt}.pdf`));

  await ctx.telegram.sendDocument(id, {
    source: data,
    filename: `${txt}.pdf`,
  });
  son = 0;
  // pages.forEach((el) => {
  //   fs.unlinkSync(el);
  // });
  fs.unlinkSync(path.join(__dirname, `${txt}.pdf`));

  return ctx.wizard.selectStep(1);
});

const menuSchema = new Scenes.WizardScene("sceneWizard", newWizart, photoAdd);

const stage = new Scenes.Stage([menuSchema]);
bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const about = ctx.update.message.from;
  const id = ctx.update.message.from.id;
  const name =
    ctx.update.message.from.username || ctx.update.message.from.first_name;

  let user = await User.findOne({
    where: {
      telegramId: id,
    },
  });
  console.log(user);
  if (!user) {
    user = await User.create({
      username: name,
      telegramId: id,
    });
  } else {
    // await User.update({ username: name }, { where: { telegramId: id } });
  }
  ctx.telegram.sendMessage(
    id,
    `Salom qadrli ${about.first_name} bizning image to pdf  Botimizga xush kelibsiz  agar bizning botimizdan foydalanmoqchi bo'lsangiz ✅ yoki ❌ buyrug'idan foydalaning`,
    {
      reply_markup: {
        one_time_keyboard: true,
        keyboard: [[{ text: "Yes ✅" }], [{ text: "No ❌" }]],
        resize_keyboard: true,
        remove_keyboard: true,
      },
    }
  );
  return ctx.scene.enter("sceneWizard");
});

bot.catch((error) => {
  console.log(error.stack);
  bot.telegram.sendMessage("1953925296", String(error.message));
});

console.log("Bot is running");
bot.launch();
