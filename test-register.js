import axios from 'axios';

async function testRegister() {
  try {
    console.log('开始测试注册功能...');
    console.log('测试URL:', 'https://18a563a7.game-website-406.pages.dev/api/auth/register');
    
    const response = await axios.post('https://18a563a7.game-website-406.pages.dev/api/auth/register', {
      nickname: 'testuser123',
      email: 'test123@example.com',
      password: 'Test123456'
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('注册成功！');
    console.log('返回状态码:', response.status);
    console.log('返回数据:', response.data);
    return response.data;
  } catch (error) {
    console.error('注册失败！');
    if (error.response) {
      // 服务器返回了错误响应
      console.error('返回状态码:', error.response.status);
      console.error('返回数据:', error.response.data);
      console.error('返回头:', error.response.headers);
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      console.error('请求已发出，但没有收到响应:', error.request);
    } else {
      // 在设置请求时发生了错误
      console.error('请求设置错误:', error.message);
    }
    console.error('完整错误:', error);
    throw error;
  }
}

// 运行测试
testRegister().catch(err => {
  console.error('测试结束，发生错误:', err);
  process.exit(1);
});
