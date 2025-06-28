import axios from 'axios';
import * as admin from 'firebase-admin';


import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as functions from 'firebase-functions';
import { Joke } from './joke';


// Initialize Firebase Admin SDK.
// In a Firebase Functions environment, initializeApp() can be called without arguments
// to automatically discover the project configuration.
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}


async function fetchJokeFromAzure(dataSetId: number): Promise<Map<string, Joke[]>> {
    const response = await axios.get(`https://daily-dad-humor3.azurewebsites.net/api/JokesForNotificatiion?dataset=${dataSetId}`);
    //const response = await axios.get(`http://localhost:7071/api/JokesForNotificatiion?dataset=${dataSetId}`);
    logger.info(`dupa`);
    logger.info(`data obtained ${JSON.stringify(response.data)}`);
    const obj = response.data as Record<string, Joke[]>;
    logger.info(`dupa1`);
    return new Map<string, Joke[]>(Object.entries(obj));
}

async function sendPushToTopic(jokes: Array<Joke>, topic: string): Promise<void> {

    logger.info(`Attempting to send joke to topic: [${topic}]`, { jokes: JSON.stringify(jokes) });


    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
        logger.error("GCLOUD_PROJECT environment variable is not set.");
        throw new Error("Project ID not found. Cannot send FCM message.");
    }

    const accessToken = (await admin.credential.applicationDefault().getAccessToken()).access_token;
    if (!accessToken) {
        logger.error("Failed to retrieve OAuth2 access token.");
        throw new Error("Failed to retrieve OAuth2 access token.");
    }

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const hours24 = 86400;
    const minutes10 = 600;
    const ttl = hours24 + minutes10

    //todo: remove
    //const ttl = 500;

    const apnsExpiration = getApnsExpiration(ttl);

    const jokesData: Record<string, string> = {};

    jokes.forEach((joke, index) => {
        const i = index + 1; // To make keys like content1, content2, etc.
        jokesData[`content${i}`] = removeUnsupportedChars(joke.content) || "";
        jokesData[`author${i}`] = removeUnsupportedChars(joke.author || '');
        jokesData[`jokeId${i}`] = joke.jokeId || '';
        jokesData[`explanation${i}`] = joke.explanation || '';
        jokesData[`rating${i}`] = `${joke.rating || 0}`;
    });

    const payloadStr = JSON.stringify(jokesData);
    const byteLength = Buffer.byteLength(payloadStr, 'utf8');

    console.log(`Payload size: ${byteLength} bytes`);


    const message = {
        message: {
            topic: topic, // For HTTP v1, just the topic name, not /topics/
            notification: {
                title: 'Your Daily Joke!',
                body: 'Tap to reveal'
            },
            data: jokesData,
            "android": {
                "ttl": `${ttl}s`  // ✅ TTL for Android (24 hours)
            },
            "apns": {
                "headers": {
                    "apns-expiration": `${apnsExpiration}`  // ✅ UNIX timestamp (seconds)
                }
            }
        }
    };

    await axios.post(fcmEndpoint, message, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    logger.info(`Successfully sent push notification to topic: ${topic}`);
}

function removeUnsupportedChars(text: string): string {
    return text.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}

function getApnsExpiration(ttlInSeconds: number): string {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return String(nowInSeconds + ttlInSeconds);
}

async function sendHourlyJoke(dataSetId: number) {
 try {
        const jokeList = await fetchJokeFromAzure(dataSetId);
        await processJokeList(dataSetId, jokeList);
        logger.info(`✅ Jokes sent to topics`); // Using logger.info for consistency
    } catch (error) {
        logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
    }
}

export const sendHourlyJoke0 = onSchedule("0 * * * *", async () => sendHourlyJoke(0));
export const sendHourlyJoke1 = onSchedule("0 * * * *", async () => sendHourlyJoke(1));
export const sendHourlyJoke2 = onSchedule("0 * * * *", async () => sendHourlyJoke(2));
export const sendHourlyJoke3 = onSchedule("0 * * * *", async () => sendHourlyJoke(3));
export const sendHourlyJoke4 = onSchedule("0 * * * *", async () => sendHourlyJoke(4));


async function processJokeList(dataSetId: number,jokeList: Map<string, Joke[]>): Promise<void> {
    const now = new Date(Date.now() + 25_000); // add 25 seconds
    const hour = now.getUTCHours();
    const hourPart = String(hour).padStart(2, '0');

    logger.info(`✅ Start sending`); // Using logger.info for consistency

    for (const [topicName, jokes] of jokeList.entries()) {
        const topic = `${topicName}-${hourPart}-${dataSetId}-test`;

        await sendPushToTopic(jokes, topic);
    }

    logger.info(`✅ End sending`); // Using logger.info for consistency
}

export const testJokePush = functions.https.onRequest((req, res) => {
    new Promise(async () => {
        if (req.path === '/' || req.path === '/healthz') {
            res.status(200).send('OK');
            return;
        }
        logger.info(`Http trigger test`);
        try {
            const jokeList = await fetchJokeFromAzure(0);
            processJokeList(0, jokeList);
            logger.info(`✅ Jokes sent to topics`); // Using logger.info for consistency
        } catch (error) {
            logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
        }
    });
});