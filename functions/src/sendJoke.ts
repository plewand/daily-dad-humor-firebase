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


type JokeSetResponse = {
    jokes: Record<string, Joke[]>;
    bestJokes: Joke[];
}

class JokeSet {
    jokes: Map<string, Joke[]>;
    bestJokes: Joke[];

    constructor(jokes: Map<string, Joke[]>, bestJokes: Joke[]) {
        this.jokes = jokes;
        this.bestJokes = bestJokes;
    }
}

async function fetchJokeFromAzure(dataSetId: number): Promise<JokeSet> {
    //const response = await axios.get(`https://daily-dad-humor3.azurewebsites.net/api/JokesForNotificatiion?dataset=${dataSetId}`);
    const response = await axios.get(`http://localhost:7071/api/JokesForNotificatiion?dataset=${dataSetId}`);
    // logger.info(`data obtained ${JSON.stringify(response.data)}`);
    const obj = response.data as JokeSetResponse;
    return new JokeSet(new Map<string, Joke[]>(Object.entries(obj.jokes)), obj.bestJokes);
}

async function sendPushToTopic(jokes: Joke[], bestJokes: Joke[], topic: string): Promise<void> {

    logger.info(`Attempting to send joke to topic: [${topic}]`, { jokes: JSON.stringify(jokes), bestJokes: JSON.stringify(jokes) });


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

    const jokesDataWithBestJokes: Record<string, string> = {};

    jokes.forEach((joke, index) => {
        const i = index + 1; // To make keys like content1, content2, etc.
        jokesDataWithBestJokes[`content${i}`] = removeUnsupportedChars(joke.content) || "";
        jokesDataWithBestJokes[`author${i}`] = removeUnsupportedChars(joke.author || '');
        jokesDataWithBestJokes[`jokeId${i}`] = joke.jokeId || '';
        jokesDataWithBestJokes[`explanation${i}`] = joke.explanation || '';
        jokesDataWithBestJokes[`rating${i}`] = `${joke.rating || 0}`;
    });

    bestJokes.forEach((joke, index) => {
        const i = index + 1; // To make keys like content1, content2, etc.
        jokesDataWithBestJokes[`b_content${i}`] = removeUnsupportedChars(joke.content) || "";
        jokesDataWithBestJokes[`b_author${i}`] = removeUnsupportedChars(joke.author || '');
        jokesDataWithBestJokes[`b_jokeId${i}`] = joke.jokeId || '';
        jokesDataWithBestJokes[`b_explanation${i}`] = joke.explanation || '';
        jokesDataWithBestJokes[`b_rating${i}`] = `${joke.rating || 0}`;
    });

    const payloadStr = JSON.stringify(jokesData);
    const byteLength = Buffer.byteLength(payloadStr, 'utf8');

    const payloadWithBestJokesStr = JSON.stringify(jokesDataWithBestJokes);
    const byteWithBestJokesLength = Buffer.byteLength(payloadWithBestJokesStr, 'utf8');

    const dataThreshold = 4000;
    const useLimited = byteWithBestJokesLength > dataThreshold;
    const chosenSet = useLimited ? jokesData : jokesDataWithBestJokes;

    //console.log(`data sent ${chosenSet}`);
    console.log(`Payload size: ${byteLength} , with best jokes: ${byteWithBestJokesLength} bytes, best jokes included ${!useLimited}`);

    //await sendMessage(topic, JSON.stringify(chosenSet), ttl, apnsExpiration, true, fcmEndpoint, accessToken);
    //await sendMessage(topic, JSON.stringify(chosenSet), ttl, apnsExpiration, false, fcmEndpoint, accessToken);
    //  const message = {
    //     message: {
    //         topic: topic, // For HTTP v1, just the topic name, not /topics/
    //         notification: {
    //             title: 'Your Daily Joke!',
    //             body: 'Tap to reveal'
    //         },
    //         data: chosenSet,
    //         "android": {
    //             "ttl": `${ttl}s`  // ✅ TTL for Android (24 hours)
    //         },
    //         "apns": {
    //             "headers": {
    //                 "apns-expiration": `${apnsExpiration}`  // ✅ UNIX timestamp (seconds)
    //             }
    //         }
    //     }
    // };

    // const soundAndroid = useSound ? 'default' : undefined;
    // const soundIos = useSound ? 'default' : '';
    
    await sendMessage(true);
    await sendMessage(false);

    async function sendMessage(useSound: boolean) {
        if (!useSound) {
            topic = topic + "-silent";
        }
        const soundAndroid = useSound ? 'default' : undefined;
        const soundIos = useSound ? 'default' : '';

        const message = {
            message: {
                topic: topic, // For HTTP v1, just the topic name, not /topics/
                notification: {
                    title: 'Your Daily Joke!',
                    body: 'Tap to reveal'
                },
                data: chosenSet,
                android: {
                    ttl: `${ttl}s`, // ✅ TTL for Android (24 hours)
                    notification: {
                        sound: soundAndroid // or omit this field
                    }
                },
                apns: {
                    headers: {
                        "apns-expiration": `${apnsExpiration}` // ✅ UNIX timestamp (seconds)
                    },
                    payload: {
                        aps: {
                            sound: soundIos // 🔇 Empty string disables sound
                        }
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
        const jokeSet = await fetchJokeFromAzure(dataSetId);
        await processJokeList(dataSetId, jokeSet);
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


async function processJokeList(dataSetId: number, jokeSet: JokeSet): Promise<void> {
    const now = new Date(Date.now() + 25_000); // add 25 seconds
    const hour = now.getUTCHours();
    const hourPart = String(hour).padStart(2, '0');

    logger.info(`✅ Start sending`); // Using logger.info for consistency

    for (const [topicName, jokes] of jokeSet.jokes.entries()) {
        const topic = `${topicName}-${hourPart}-${dataSetId}-test`;

        await sendPushToTopic(jokes, jokeSet.bestJokes, topic);
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
            const jokeSet = await fetchJokeFromAzure(0);
            processJokeList(0, jokeSet);
            logger.info(`✅ Jokes sent to topics`); // Using logger.info for consistency
        } catch (error) {
            logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
        }
    });
});