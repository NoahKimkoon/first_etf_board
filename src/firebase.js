import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsEtwSr3IOEN2hSD5zvO9VcUxHuMIHFCQ",
  authDomain: "first-7c3ca.firebaseapp.com",
  projectId: "first-7c3ca",
  storageBucket: "first-7c3ca.firebasestorage.app",
  messagingSenderId: "461314685146",
  appId: "1:461314685146:web:265743966ca3a6d4434de3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ 초기화 디버깅 로그
console.log('✅ Firebase 초기화 완료:', app.name);
console.log('✅ Firestore DB 객체:', db);

export { db };
