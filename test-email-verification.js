// 测试邮箱验证功能脚本
import axios from 'axios';

// API基础URL
const API_BASE_URL = 'http://localhost:8787';

// 测试账号信息 - 使用时间戳避免重复
const shortTimestamp = Date.now().toString().slice(-6); // 只使用时间戳的最后6位
const testUser = {
  username: `test_${shortTimestamp}`,
  password: 'Test@123456',
  email: `test_${shortTimestamp}@example.com`,
  userCode: null // 将在注册成功后从响应中获取
};

// 测试流程
async function runTests() {
  console.log('开始测试邮箱验证功能...');
  
  try {
    // 0. 先尝试注册测试用户
    console.log('\n0. 尝试注册测试用户...');
    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        password: testUser.password,
        nickname: 'TestUser',
        email: testUser.email
      });
      
      if (registerResponse.data.success) {
        console.log('✅ 测试用户注册成功');
        // 从响应中获取真实的userCode
        testUser.userCode = registerResponse.data.data.user.user_code;
        console.log('获取到的userCode:', testUser.userCode);
      } else {
        console.log('⚠️ 用户可能已存在:', registerResponse.data.error?.message);
        // 如果用户已存在，我们需要通过其他方式获取userCode
        // 这里简化处理，使用email查询
        console.log('🔄 尝试通过邮箱获取userCode...');
      }
    } catch (error) {
      console.log('⚠️ 注册失败（用户可能已存在）:', error.response?.data?.error?.message || error.message);
      console.log('🔄 继续测试登录功能...');
      // 在实际测试中，我们可以通过数据库查询获取已注册用户的userCode
    }
    
    // 1. 登录获取token
    console.log('\n1. 测试用户登录...');
    try {
      // 注意：在真实环境中，userCode是由系统生成的6位数字
      // 这里为了测试，我们暂时使用email进行登录（因为我们知道email）
      const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      
      if (loginResponse.data.success) {
        console.log('✅ 登录成功');
        const token = loginResponse.data.data.token;
        console.log('获取到的token:', token.substring(0, 20) + '...');
        
        // 2. 发送验证码
        console.log('\n2. 测试发送验证码...');
        try {
          const sendCodeResponse = await axios.post(`${API_BASE_URL}/api/auth/send-verification-code`, {
            email: testUser.email
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (sendCodeResponse.data.success) {
            console.log('✅ 验证码发送成功');
            console.log('验证码有效期:', sendCodeResponse.data.data.expirySeconds, '秒');
            console.log('注意: 在实际测试中，验证码会显示在auth-worker的控制台输出中');
            
            // 3. 模拟验证和绑定邮箱（这里使用123456作为测试验证码）
            console.log('\n3. 测试邮箱绑定...');
            console.log('提示: 请查看auth-worker控制台，获取实际生成的验证码');
            console.log('使用测试验证码: 123456 进行模拟测试');
            
            try {
              const bindResponse = await axios.post(`${API_BASE_URL}/api/users/me/email`, {
                email: testUser.email,
                verificationCode: '123456' // 这里需要替换为实际生成的验证码
              }, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (bindResponse.data.success) {
                console.log('✅ 邮箱绑定成功');
              } else {
                console.log('❌ 邮箱绑定失败:', bindResponse.data.error?.message || '未知错误');
                console.log('错误代码:', bindResponse.data.error?.code);
              }
            } catch (error) {
              console.log('❌ 邮箱绑定请求失败:', error.response?.data?.error?.message || error.message);
            }
            
          } else {
            console.log('❌ 验证码发送失败:', sendCodeResponse.data.error?.message || '未知错误');
          }
        } catch (error) {
          console.log('❌ 发送验证码请求失败:', error.response?.data?.error?.message || error.message);
          if (error.response?.status === 429) {
            console.log('触发了频率限制，这是正常的安全机制');
          }
        }
        
        // 4. 获取用户信息，验证邮箱是否已绑定
        console.log('\n4. 验证用户信息...');
        try {
          const userInfoResponse = await axios.get(`${API_BASE_URL}/api/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (userInfoResponse.data.success) {
            console.log('✅ 获取用户信息成功');
            console.log('用户邮箱:', userInfoResponse.data.data.email || '未绑定');
            console.log('用户昵称:', userInfoResponse.data.data.nickname);
            console.log('用户ID:', userInfoResponse.data.data.id);
          }
        } catch (error) {
          console.log('❌ 获取用户信息失败:', error.message);
        }
        
      } else {
        console.log('❌ 登录失败:', loginResponse.data.error?.message);
      }
    } catch (error) {
      console.error('登录测试过程中发生错误:', error.message);
    }
    
  } catch (error) {
    console.error('测试过程中发生错误:', error.message);
  }
  
  console.log('\n测试完成');
}

// 运行测试
runTests();