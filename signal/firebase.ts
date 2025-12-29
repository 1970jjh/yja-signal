
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove, push } from 'firebase/database';

// Firebase 설정 - 본인의 Firebase 프로젝트 설정으로 교체하세요
// https://console.firebase.google.com 에서 프로젝트 생성 후 설정값 복사
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, get, onValue, update, remove, push };
