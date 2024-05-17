require("dotenv").config();
const { MongoClient } = require("mongodb");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require('selenium-webdriver/chrome');
const schedule = require('node-schedule');
const TelegramBot = require('node-telegram-bot-api');

// 환경 변수 설정
const dbUser = process.env.DB_USER;
const dbPassword = encodeURIComponent(process.env.DB_PASSWORD);
const dbName = "richlab";
const dburl = `mongodb+srv://${dbUser}:${dbPassword}@cluster0.xseitpb.mongodb.net/`;
const chatId = process.env.TELE_CHAT_ID;
const chatId2 = process.env.TELE_CHAT_ID_SH;
const token = process.env.TELE_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true, request: { agentOptions: { keepAlive: true, family: 4 } } });
let db, driver;

// 데이터베이스 연결
async function connectDatabase() {
    const client = await MongoClient.connect(dburl);
    console.log("DB연결성공");
    db = client.db(dbName);
    await initDriver();
    scheduleJob();
}

// 드라이버 초기화
async function initDriver() {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options()
        .addArguments(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "accept-language=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "headless",
            "no-sandbox",
            "disable-gpu",
            "window-size=1920x1080"
        )).build();
}

// 스케줄러 설정
async function scheduleJob() {
    schedule.scheduleJob('*/1 * * * *', async function () {
        const detections = await fetchDetections();
        for (const detection of detections) {
            await generate(detection);
        }
    });
}

// 탐지 설정 가져오기
async function fetchDetections() {
    return db.collection("detect").find({}).toArray().then(results => {
        return results.map(doc => ({ url: doc.url, buttonType: doc.buttonType, text: doc.text }));
    });
}

// URL에서 요소 생성
async function generate({ url, buttonType, text }) {
    const text = []
    try {
        await driver.get(url);
        const button = await driver.wait(until.elementLocated(By.css(buttonType)), 2000);
        const buttonText = await button.getText();
        if (buttonText === text) {
            console.log(`STATUS : SOLD OUT for ${url}`);

        } else {
            console.log(`buttonText = ${buttonText}`);
            console.log(`Text = ${text}`);
            console.log(`STATUS : AVAILABLE for ${url}`);
            // await bot.sendMessage(chatId, `재고 입고된듯 ${url}`);
            // await bot.sendMessage(chatId2, `재고 입고된듯 ${url}`);
        }
    } catch (error) {
        console.log(`Error processing ${url}: ${error}`);
    }
    // 봇 연결
    // bot.onText(/\/add (.+)/, async (msg, match) => {
    //     const msgchatId = msg.chat.id;
    //     const resp = match[1];
    //     console.log(resp);
    //     console.log(`chatId = ${msgchatId}`);
    //     try {
    //         await db.collection("detect").insertOne({ url: resp });
    //         bot.sendMessage(msgchatId, `${resp} 가 db에 저장되었습니다.`);
    //     } catch (e) {
    //         console.log(e);
    //     }
    // });
}

module.exports = { connectDatabase };