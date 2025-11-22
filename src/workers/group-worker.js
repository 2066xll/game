// Cloudflare Worker for Chat Group Management
import { verifyToken } from './utils/auth.js'
import { createDbInstance } from './database/db.js'

// 创建数据库实例
const db = createDbInstance(env)

// 处理CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

// 错误处理函数
function handleError(error, status = 500) {
  console.error('Error:', error)
  return new Response(JSON.stringify({
    success: false,
    message: error.message || 'Internal server error'
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

// 验证用户身份的中间件
async function authenticate(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authentication required')
    }
    
    const token = authHeader.split(' ')[1]
    const userData = await verifyToken(token)
    
    if (!userData || !userData.userId) {
      throw new Error('Invalid token')
    }
    
    return userData
  } catch (error) {
    throw new Error('Authentication failed: ' + error.message)
  }
}

// 格式化群组数据
function formatGroup(group, members = []) {
  return {
    id: group.id,
    name: group.name,
    ownerId: group.owner_id,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    members: members.map(member => ({
      id: member.id,
      username: member.username,
      nickname: member.nickname,
      avatar: member.avatar,
      joinedAt: member.joined_at
    }))
  }
}

// 获取用户的群组列表
async function getGroups(request, env, ctx) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 查询用户加入的所有群组
    const groups = await db.query(
      `SELECT g.* FROM chat_groups g
       JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = ?
       ORDER BY g.updated_at DESC`,
      [userId]
    )
    
    // 获取每个群组的成员信息
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const members = await db.query(
          `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
           FROM users u
           JOIN user_groups ug ON u.id = ug.user_id
           WHERE ug.group_id = ?`,
          [group.id]
        )
        return formatGroup(group, members)
      })
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: groupsWithMembers
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 创建新群组
async function createGroup(request, env, ctx) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    const data = await request.json()
    
    // 验证输入
    if (!data.name || data.name.trim().length === 0) {
      return handleError(new Error('Group name is required'), 400)
    }
    
    if (data.name.length > 100) {
      return handleError(new Error('Group name is too long'), 400)
    }
    
    // 使用事务确保数据一致性
    await db.transaction(async (tx) => {
      // 创建群组
      const groupResult = await tx.run(
        `INSERT INTO chat_groups (name, owner_id, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [data.name.trim(), userId]
      )
      
      const groupId = groupResult.lastInsertRowid
      
      // 创建者自动加入群组
      await tx.run(
        `INSERT INTO user_groups (user_id, group_id, joined_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [userId, groupId]
      )
      
      // 如果有其他成员，添加到群组
      if (data.userIds && Array.isArray(data.userIds) && data.userIds.length > 0) {
        const filteredUserIds = data.userIds.filter(id => id !== userId)
        
        for (const memberId of filteredUserIds) {
          try {
            await tx.run(
              `INSERT OR IGNORE INTO user_groups (user_id, group_id, joined_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)`,
              [memberId, groupId]
            )
          } catch (err) {
            console.warn(`Failed to add user ${memberId} to group ${groupId}:`, err)
          }
        }
      }
    })
    
    // 获取新创建的群组信息
    const newGroup = await db.queryOne(
      `SELECT * FROM chat_groups WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    
    const members = await db.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = ?`,
      [newGroup.id]
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: formatGroup(newGroup, members)
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 加入群组
async function joinGroup(request, env, ctx, groupId) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 检查群组是否存在
    const group = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ?`,
      [groupId]
    )
    
    if (!group) {
      return handleError(new Error('Group not found'), 404)
    }
    
    // 检查用户是否已经在群组中
    const existingMember = await db.queryOne(
      `SELECT * FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    )
    
    if (existingMember) {
      return handleError(new Error('Already a member of this group'), 400)
    }
    
    // 添加用户到群组
    await db.run(
      `INSERT INTO user_groups (user_id, group_id, joined_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, groupId]
    )
    
    // 更新群组的更新时间
    await db.run(
      `UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [groupId]
    )
    
    // 获取更新后的群组信息
    const updatedGroup = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ?`,
      [groupId]
    )
    
    const members = await db.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = ?`,
      [groupId]
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: formatGroup(updatedGroup, members)
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 离开群组
async function leaveGroup(request, env, ctx, groupId) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 检查群组是否存在
    const group = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ?`,
      [groupId]
    )
    
    if (!group) {
      return handleError(new Error('Group not found'), 404)
    }
    
    // 检查用户是否是群组的所有者
    if (group.owner_id === userId) {
      // 如果是群主，检查是否还有其他成员
      const memberCount = await db.queryOne(
        `SELECT COUNT(*) as count FROM user_groups WHERE group_id = ?`,
        [groupId]
      )
      
      if (memberCount.count <= 1) {
        // 只有群主一人，删除整个群组
        await db.transaction(async (tx) => {
          // 删除用户群组关系
          await tx.run(`DELETE FROM user_groups WHERE group_id = ?`, [groupId])
          // 删除群组消息
          await tx.run(`DELETE FROM messages WHERE group_id = ?`, [groupId])
          // 删除群组
          await tx.run(`DELETE FROM chat_groups WHERE id = ?`, [groupId])
        })
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Group deleted successfully',
          data: { groupId, deleted: true }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      } else {
        // 有其他成员，需要转让群主并离开
        // 选择第一个加入的成员作为新群主
        const newOwner = await db.queryOne(
          `SELECT user_id FROM user_groups 
           WHERE group_id = ? AND user_id != ? 
           ORDER BY joined_at ASC LIMIT 1`,
          [groupId, userId]
        )
        
        if (!newOwner) {
          return handleError(new Error('Failed to find new owner'), 500)
        }
        
        await db.transaction(async (tx) => {
          // 更新群主
          await tx.run(
            `UPDATE chat_groups SET owner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newOwner.user_id, groupId]
          )
          // 移除原群主的成员身份
          await tx.run(
            `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`,
            [userId, groupId]
          )
        })
      }
    } else {
      // 普通成员，直接离开
      await db.run(
        `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`,
        [userId, groupId]
      )
      
      // 更新群组的更新时间
      await db.run(
        `UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [groupId]
      )
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Left group successfully',
      data: { groupId }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 获取群组详情
async function getGroupDetail(request, env, ctx, groupId) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 检查群组是否存在且用户是否在群组中
    const membership = await db.queryOne(
      `SELECT * FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    )
    
    if (!membership) {
      return handleError(new Error('Group not found or not a member'), 404)
    }
    
    // 获取群组信息
    const group = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ?`,
      [groupId]
    )
    
    // 获取群组所有成员
    const members = await db.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = ?`,
      [groupId]
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: formatGroup(group, members)
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 更新群组信息
async function updateGroup(request, env, ctx, groupId) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 检查用户是否是群组的所有者
    const group = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ? AND owner_id = ?`,
      [groupId, userId]
    )
    
    if (!group) {
      return handleError(new Error('Group not found or not authorized'), 404)
    }
    
    const data = await request.json()
    
    // 更新群组信息
    if (data.name && data.name.trim().length > 0) {
      if (data.name.length > 100) {
        return handleError(new Error('Group name is too long'), 400)
      }
      
      await db.run(
        `UPDATE chat_groups SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [data.name.trim(), groupId]
      )
    }
    
    // 获取更新后的群组信息
    const updatedGroup = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ?`,
      [groupId]
    )
    
    const members = await db.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = ?`,
      [groupId]
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: formatGroup(updatedGroup, members)
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 从群组中移除成员（仅群主）
async function removeMember(request, env, ctx, groupId, memberId) {
  try {
    const userData = await authenticate(request)
    const userId = userData.userId
    
    // 检查用户是否是群组的所有者
    const group = await db.queryOne(
      `SELECT * FROM chat_groups WHERE id = ? AND owner_id = ?`,
      [groupId, userId]
    )
    
    if (!group) {
      return handleError(new Error('Group not found or not authorized'), 404)
    }
    
    // 不能移除自己
    if (userId === memberId) {
      return handleError(new Error('Cannot remove yourself'), 400)
    }
    
    // 检查成员是否在群组中
    const member = await db.queryOne(
      `SELECT * FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [memberId, groupId]
    )
    
    if (!member) {
      return handleError(new Error('User is not a member of this group'), 404)
    }
    
    // 移除成员
    await db.run(
      `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [memberId, groupId]
    )
    
    // 更新群组的更新时间
    await db.run(
      `UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [groupId]
    )
    
    // 获取更新后的群组信息
    const members = await db.query(
      `SELECT u.id, u.username, u.nickname, u.avatar, ug.joined_at
       FROM users u
       JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = ?`,
      [groupId]
    )
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Member removed successfully',
      data: {
        groupId,
        members
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  } catch (error) {
    return handleError(error, error.message.includes('Authentication') ? 401 : 500)
  }
}

// 主处理函数
async function handleRequest(request, env, ctx) {
  // 处理OPTIONS请求
  if (request.method === 'OPTIONS') {
    return new Response('OK', {
      headers: corsHeaders
    })
  }
  
  const url = new URL(request.url)
  const path = url.pathname
  
  // API路由处理
  if (path === '/api/chat/groups' && request.method === 'GET') {
    return getGroups(request, env, ctx)
  } else if (path === '/api/chat/groups' && request.method === 'POST') {
    return createGroup(request, env, ctx)
  } else if (path.match(/\/api\/chat\/groups\/[^/]+$/) && request.method === 'GET') {
    const groupId = path.split('/').pop()
    return getGroupDetail(request, env, ctx, groupId)
  } else if (path.match(/\/api\/chat\/groups\/[^/]+$/) && request.method === 'PUT') {
    const groupId = path.split('/').pop()
    return updateGroup(request, env, ctx, groupId)
  } else if (path.match(/\/api\/chat\/groups\/[^/]+\/join$/) && request.method === 'POST') {
    const groupId = path.split('/').slice(-2, -1)[0]
    return joinGroup(request, env, ctx, groupId)
  } else if (path.match(/\/api\/chat\/groups\/[^/]+\/leave$/) && request.method === 'POST') {
    const groupId = path.split('/').slice(-2, -1)[0]
    return leaveGroup(request, env, ctx, groupId)
  } else if (path.match(/\/api\/chat\/groups\/[^/]+\/members\/[^/]+$/) && request.method === 'DELETE') {
    const [groupId, memberId] = path.split('/').slice(-3)
    return removeMember(request, env, ctx, groupId, memberId)
  }
  
  // 未匹配的路由
  return new Response(JSON.stringify({
    success: false,
    message: 'Not found'
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

// 导出处理函数
export default {
  fetch: handleRequest
}