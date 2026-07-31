const input = document.getElementById('appUrl')
const msg = document.getElementById('msg')

chrome.storage.sync.get({ appUrl: 'http://localhost:5173' }, (data) => {
  input.value = data.appUrl
})

document.getElementById('save').addEventListener('click', () => {
  const appUrl = input.value.trim().replace(/\/$/, '')
  chrome.storage.sync.set({ appUrl }, () => {
    msg.textContent = '已保存'
  })
})
