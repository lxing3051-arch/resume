const input = document.getElementById('appUrl')
const msg = document.getElementById('msg')

chrome.storage.sync.get({ appUrl: 'https://lxing3051-arch.github.io/resume' }, (data) => {
  input.value = data.appUrl
})

document.getElementById('save').addEventListener('click', () => {
  let appUrl = input.value.trim().replace(/\/$/, '')
  if (appUrl.includes('github.io') && !appUrl.match(/github\.io\/[^/]+/)) {
    msg.textContent = 'GitHub Pages 地址需包含仓库名，如 https://用户名.github.io/resume'
    msg.style.color = '#b91c1c'
    return
  }
  chrome.storage.sync.set({ appUrl }, () => {
    msg.textContent = '已保存：' + appUrl
    msg.style.color = '#15803d'
  })
})
