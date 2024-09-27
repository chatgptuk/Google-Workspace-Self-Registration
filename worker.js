addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * 处理传入的请求
 * @param {Request} request
 */
async function handleRequest(request) {
  if (request.method === 'GET') {
    return serveRegistrationForm()
  } else if (request.method === 'POST') {
    return handleRegistration(request)
  } else {
    return new Response('Method Not Allowed', { status: 405 })
  }
}

/**
 * 提供注册表单的 HTML
 */
function serveRegistrationForm() {
  const emailDomain = EMAIL_DOMAIN || '@chatgpt.nyc.mn'
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Workspace 注册</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 50px; }
          form { max-width: 400px; margin: auto; }
          input[type="text"], input[type="password"] {
            width: 100%; padding: 12px; margin: 8px 0; box-sizing: border-box;
          }
          input[type="submit"] {
            width: 100%; padding: 12px; background-color: #4CAF50; color: white; border: none;
          }
        </style>
      </head>
      <body>
        <h2>注册到 Google Workspace</h2>
        <form method="POST">
          <label for="firstName">名字:</label><br>
          <input type="text" id="firstName" name="firstName" required><br>
          
          <label for="lastName">姓氏:</label><br>
          <input type="text" id="lastName" name="lastName" required><br>
          
          <label for="username">用户名:</label><br>
          <input type="text" id="username" name="username" required><br>
          <small>邮箱后缀将自动添加为 <strong>${escapeHtml(emailDomain)}</strong></small><br><br>
          
          <label for="password">密码:</label><br>
          <input type="password" id="password" name="password" required><br>
          
          <label for="verificationCode">验证码:</label><br>
          <input type="text" id="verificationCode" name="verificationCode" required><br><br>
          
          <input type="submit" value="注册">
        </form>
      </body>
    </html>
  `
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  })
}

/**
 * 处理注册表单提交
 * @param {Request} request
 */
async function handleRegistration(request) {
  const formData = await request.formData()
  const firstName = formData.get('firstName')
  const lastName = formData.get('lastName')
  const username = formData.get('username')
  const password = formData.get('password')
  const verificationCode = formData.get('verificationCode')

  // 验证输入
  if (!firstName || !lastName || !username || !password || !verificationCode) {
    return new Response('所有字段都是必填的。', { status: 400 })
  }

  // 验证答案
  if (verificationCode !== VERIFICATION_CODE) {
    return new Response('验证码错误。', { status: 400 })
  }

  // 构建完整的邮箱地址
  const email = `${username}${EMAIL_DOMAIN}`

  // 验证邮箱后缀
  if (!email.endsWith(EMAIL_DOMAIN)) {
    return new Response(`邮箱后缀必须是 ${EMAIL_DOMAIN}。`, { status: 400 })
  }

  try {
    // 获取访问令牌
    const accessToken = await getAccessToken()

    // 创建用户对象
    const user = {
      name: {
        givenName: firstName,
        familyName: lastName,
      },
      password: password,
      primaryEmail: email,
    }

    // 调用 Google Admin SDK 创建用户
    const response = await fetch('https://admin.googleapis.com/admin/directory/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    })

    if (response.ok) {
      // 注册成功后，自动重定向到谷歌登录页面并预填充邮箱
      const redirectHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>注册成功</title>
            <meta http-equiv="refresh" content="1;url=https://accounts.google.com/ServiceLogin?Email=${encodeURIComponent(email)}&continue=https://mail.google.com/mail/">
          </head>
          <body>
            <h2>注册成功！</h2>
            <p>用户 ${escapeHtml(email)} 已成功创建。</p>
            <p>正在跳转到谷歌登录页面...</p>
          </body>
        </html>
      `
      return new Response(redirectHtml, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      })
    } else {
      const error = await response.json()
      return new Response(`注册失败: ${error.error.message}`, { status: 500 })
    }
  } catch (error) {
    return new Response(`内部错误: ${error.message}`, { status: 500 })
  }
}

/**
 * 获取 Google API 访问令牌
 */
async function getAccessToken() {
  const clientId = GOOGLE_CLIENT_ID
  const clientSecret = GOOGLE_CLIENT_SECRET
  const refreshToken = GOOGLE_REFRESH_TOKEN

  const tokenEndpoint = 'https://oauth2.googleapis.com/token'

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('client_secret', clientSecret)
  params.append('refresh_token', refreshToken)
  params.append('grant_type', 'refresh_token')

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`无法获取访问令牌: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param {string} unsafe
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * 从 Workers 环境变量中获取秘密变量
 */
const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET
const GOOGLE_REFRESH_TOKEN = GOOGLE_REFRESH_TOKEN
const GOOGLE_ADMIN_EMAIL = GOOGLE_ADMIN_EMAIL
const VERIFICATION_CODE = VERIFICATION_CODE
const EMAIL_DOMAIN = EMAIL_DOMAIN

/**
也可以不使用环境变量
const GOOGLE_CLIENT_ID = ''
const GOOGLE_CLIENT_SECRET = ''
const GOOGLE_REFRESH_TOKEN = ''
const GOOGLE_ADMIN_EMAIL = ''
const VERIFICATION_CODE = ''
const EMAIL_DOMAIN = ''
 */

