setInterval(() => {
  fetch('https://tahvel.edu.ee/hois_back/user', {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json, text/plain, */*' },
  });
  console.log('session extended at: ' + new Date());
}, 120000);
