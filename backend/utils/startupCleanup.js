// backend/utils/startupCleanup.js
import pool from '../db.js';

/**
 * Clean up expired password reset tokens on server startup
 * This ensures that tokens that expired while the server was offline are removed
 */
export async function cleanupExpiredTokens() {
  console.log('🧹 Starting expired token cleanup...');
  
  try {
    // Count expired tokens before cleanup
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as expired_count FROM tblPasswordResetTokens WHERE ExpiresAt <= NOW() AND UsedAt IS NULL'
    );
    
    const expiredCount = countResult[0].expired_count;
    
    if (expiredCount > 0) {
      // Mark expired tokens as used (soft delete approach)
      const [result] = await pool.execute(
        `UPDATE tblPasswordResetTokens 
         SET UsedAt = NOW() 
         WHERE ExpiresAt <= NOW() AND UsedAt IS NULL`
      );
      
      console.log(`✅ Cleaned up ${expiredCount} expired password reset tokens`);
    } else {
      console.log('✅ No expired tokens found - cleanup not needed');
    }
    
    return { success: true, cleanedCount: expiredCount };
  } catch (error) {
    console.error('❌ Error during expired token cleanup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old used tokens (hard delete tokens older than 7 days)
 * This keeps the database table from growing indefinitely
 */
export async function cleanupOldUsedTokens() {
  console.log('🗑️ Starting old used tokens cleanup...');
  
  try {
    const [result] = await pool.execute(
      `DELETE FROM tblPasswordResetTokens 
       WHERE UsedAt IS NOT NULL AND UsedAt < DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    
    if (result.affectedRows > 0) {
      console.log(`✅ Deleted ${result.affectedRows} old used password reset tokens`);
    } else {
      console.log('✅ No old used tokens found - cleanup not needed');
    }
    
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    console.error('❌ Error during old token cleanup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Comprehensive startup cleanup - runs both expired and old token cleanup
 */
export async function performStartupCleanup() {
  console.log('🚀 Performing startup database cleanup...');
  
  const expiredResult = await cleanupExpiredTokens();
  const oldTokensResult = await cleanupOldUsedTokens();
  
  if (expiredResult.success && oldTokensResult.success) {
    console.log('✅ Startup cleanup completed successfully');
  } else {
    console.log('⚠️ Startup cleanup completed with some errors');
  }
  
  return {
    expired: expiredResult,
    oldTokens: oldTokensResult
  };
}