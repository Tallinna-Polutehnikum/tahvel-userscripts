export function getStudentId() {
  let id = null;

  const url = window.location.href;
  const match = url.match(/\/students\/(\d+)/);
  id = match ? match[1] : null;

  if (!id) {
    id = fetch('https://tahvel.edu.ee/hois_back/user', {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json, text/plain, */*' },
    })
      .then(res => res.json())
      .then(data => data.student);
  }

  return id;
};