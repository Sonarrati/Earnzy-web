// js/auth.js
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Check current auth status
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile(session.user.id);
        }
        this.setupAuthListener();
    }

    setupAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                await this.loadUserProfile(session.user.id);
                window.location.href = 'dashboard.html';
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                window.location.href = 'index.html';
            }
        });
    }

    async loadUserProfile(userId) {
        const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            // Create user profile if it doesn't exist
            await this.createUserProfile(userId);
        } else {
            localStorage.setItem('userProfile', JSON.stringify(profile));
        }
    }

    async createUserProfile(userId) {
        const userData = {
            id: userId,
            mobile: this.currentUser.phone || '',
            google_id: this.currentUser.user_metadata.provider_id || '',
            balance: 2.00, // ₹2 signup bonus
            total_earned: 2.00,
            subscription_plan: 'free',
            plan_expires_at: null,
            device_id: this.getDeviceId(),
            fraud_count: 0,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('users')
            .insert([userData]);

        if (!error) {
            localStorage.setItem('userProfile', JSON.stringify(userData));
            
            // Add transaction record for signup bonus
            await this.recordTransaction(userId, 2.00, 'signup_bonus', 'Credit');
        }
    }

    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    async recordTransaction(userId, amount, type, status) {
        const transaction = {
            user_id: userId,
            amount: amount,
            type: type,
            status: status,
            created_at: new Date().toISOString()
        };

        await supabase
            .from('transactions')
            .insert([transaction]);
    }

    // OTP Login
    async sendOTP(phoneNumber) {
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: '+91' + phoneNumber
        });

        if (error) {
            throw new Error(error.message);
        }
        return data;
    }

    // Verify OTP
    async verifyOTP(phoneNumber, token) {
        const { data, error } = await supabase.auth.verifyOtp({
            phone: '+91' + phoneNumber,
            token: token,
            type: 'sms'
        });

        if (error) {
            throw new Error(error.message);
        }
        return data;
    }

    // Google Login
    async googleLogin() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard.html'
            }
        });

        if (error) {
            throw new Error(error.message);
        }
    }

    // Logout
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw new Error(error.message);
        }
        localStorage.removeItem('userProfile');
        window.location.href = 'index.html';
    }

    // Check if user is admin
    async isAdmin() {
        if (!this.currentUser) return false;
        
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        return userProfile.role === 'admin' || userProfile.email === 'admin@earnzy.in';
    }
}

const authManager = new AuthManager();
