1. Wlasciwa wersja bibliotek:
{
  "dependencies": {
    "axios": "^1.9.0",
    "firebase-admin": "^11.8.0",
    "firebase-functions": "^4.3.1"
  },
  "devDependencies": {
    "globals": "^16.2.0",
    "typescript": "^4.9.5",
    "typescript-eslint": "^8.32.1"
  }
}

!!! Co zjebane to samo musi byc w package.json i functions/package.json.
!!! Wszystkie npm run build odpala się w functions/.
!!! Polecenia do deploymentu z project root.


2. Nowy projekt bez linta (moze teraz i by zadzilal)

init:
npx firebase-tools@12.9.1 init functions

build:
npm run build z katalogu functions

deploy:
npx firebase-tools@12.9.1 deploy --only functions

3. Wesja npx, nie dalo rady ianczej
npx firebase-tools@12.9.1

4. Start emulatora:
npx firebase-tools@12.9.1 emulators:start --only functions
 

curl "http://localhost:5003/daily-dad-humor-firebase/us-central1/testJokePush" -H "Content-Type: application/json" -d '{"hour": 2}'

curl "http://localhost:5003/daily-dad-humor-firebase/us-central1/sendHourlyJoke0-0"

npm run build && curl "http://localhost:5003/daily-dad-humor-firebase/us-central1/sendHourlyJoke0-0"

Wyjscie w logach

5. Release

Testowanie:
https://console.cloud.google.com/functions/details/us-central1/testJokePush?env=gen1&tab=testing&authuser=0&cloudshell=true&hl=en-US&inv=1&invt=Abycfg&project=daily-dad-humor-firebase

logi sa: 
https://console.cloud.google.com/run/detail/us-central1/sendhourlyjoke/logs?authuser=0&inv=1&invt=AbycYQ&project=daily-dad-humor-firebase

albo przez firebase - 3 kropki z settigsnami przy nazwie funkcji:
https://console.firebase.google.com/u/0/project/daily-dad-humor-firebase/functions/list

Firebase funcitons:
https://console.firebase.google.com/u/0/project/daily-dad-humor-firebase/functions/list

6. Troubleshooting

- Wazne aby funkcje i aplikacja byly w tym samym projekcie.
- Dla testow na konsoli googla
  - pierwszym razem pojawia sie error 400, ale trzeba odpalic kilka razy to dziala
  - wazne, zeby w message dla topicow byly same stringi, bez zagniezdzen

- WYglada, ze nie mozna za duzo publikowac na raz wtedy 400. Z awaitem synchronicznie, lub delayem.


