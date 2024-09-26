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
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google Workspace 注册</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 50px; }
          form { max-width: 400px; margin: auto; }
          input[type="text"], input[type="email"], input[type="password"] {
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
          <label for="email">电子邮件:</label><br>
          <input type="email" id="email" name="email" required><br>
          <label for="password">密码:</label><br>
          <input type="password" id="password" name="password" required><br><br>
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
  const email = formData.get('email')
  const password = formData.get('password')

  // 验证输入
  if (!firstName || !lastName || !email || !password) {
    return new Response('所有字段都是必填的。', { status: 400 })
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
      const successHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>注册成功</title>
          </head>
          <body>
            <h2>注册成功！</h2>
            <p>用户 ${email} 已成功创建。</p>
          </body>
        </html>
      `
      return new Response(successHtml, {
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
 * 从 Workers 环境变量中获取秘密变量
 */
const GOOGLE_CLIENT_ID = ENV.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = ENV.GOOGLE_CLIENT_SECRET
const GOOGLE_REFRESH_TOKEN = ENV.GOOGLE_REFRESH_TOKEN
const GOOGLE_ADMIN_EMAIL = ENV.GOOGLE_ADMIN_EMAIL
/**
也可以不使用环境变量
const GOOGLE_CLIENT_ID = ''
const GOOGLE_CLIENT_SECRET = ''
const GOOGLE_REFRESH_TOKEN = ''
const GOOGLE_ADMIN_EMAIL = ''

 */

