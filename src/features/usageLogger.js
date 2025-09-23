import { version } from "../version.js";

setTimeout(async () => {
  const response = await fetch(`https://tahvel.edu.ee/hois_back/user`);

  const userData = await response.json();
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    "user": userData.fullname,
    "version": version
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
  };

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Format as YYYYMMDD
  const numericDate = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;

  if(!localStorage.getItem('lastPost') || ((numericDate - localStorage.getItem('lastPost')) >= 1)) {
    localStorage.setItem('lastPost', numericDate);
    fetch("https://boringreallife.com/api/tahvel/last-usage", requestOptions)
      .then((response) => response.text())
      .then((result) => console.log(result))
      .catch((error) => console.error(error));
  }
}, 0)