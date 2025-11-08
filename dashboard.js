// js/dashboard.js
class DashboardManager {
    constructor() {
        this.userProfile = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadUserData();
        await this.loadRecentEarnings();
        await this.loadStats();
        this.setupRealTimeUpdates();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        this.userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        this.updateWelcomeMessage();
    }

    updateWelcomeMessage() {
        const name = this.userProfile.full_name || 'User';
        const time = new Date().getHours();
        let greeting = 'Good morning';
        
        if (time >= 12 && time < 17) greeting = 'Good afternoon';
        if (time >= 17) greeting = 'Good evening';
        
        document.getElementById('welcomeText').textContent = `${greeting}, ${name}!`;
    }

    async loadUserData() {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', this.userProfile.id)
            .single();

        if (!error && user) {
            this.userProfile = user;
            localStorage.setItem('userProfile', JSON.stringify(user));
            
            document.getElementById('userBalance').textContent = `₹${user.balance}`;
            document.getElementById('mainBalance').textContent = `₹${user.balance}`;
        }
    }

    async loadRecentEarnings() {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', this.userProfile.id)
            .order('created_at', { ascending: false })
            .limit(5);

        const container = document.getElementById('recentEarnings');
        
        if (error || !transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <i class="fas fa-coins text-2xl mb-2 opacity-50"></i>
                    <div>No earnings yet</div>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(transaction => `
            <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full ${transaction.amount > 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center">
                        <i class="fas ${transaction.amount > 0 ? 'fa-plus text-green-600' : 'fa-minus text-red-600'} text-sm"></i>
                    </div>
                    <div>
                        <div class="font-medium text-gray-800">${this.getTransactionType(transaction.type)}</div>
                        <div class="text-xs text-gray-500">${this.formatDate(transaction.created_at)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}">
                        ${transaction.amount > 0 ? '+' : ''}₹${Math.abs(transaction.amount)}
                    </div>
                    <div class="text-xs text-gray-500 capitalize">${transaction.status}</div>
                </div>
            </div>
        `).join('');
    }

    async loadStats() {
        // Load completed tasks count
        const { data: tasks, error: tasksError } = await supabase
            .from('task_submissions')
            .select('id')
            .eq('user_id', this.userProfile.id)
            .eq('status', 'approved');

        if (!tasksError) {
            document.getElementById('completedTasks').textContent = tasks?.length || 0;
        }

        // Load referral count
        const { data: referrals, error: refError } = await supabase
            .from('referrals')
            .select('id')
            .eq('referrer_id', this.userProfile.id);

        if (!refError) {
            document.getElementById('referralCount').textContent = referrals?.length || 0;
        }

        // Load streak count (simplified)
        const streak = this.calculateStreak();
        document.getElementById('streakCount').textContent = streak;

        // Calculate today's earnings
        await this.calculateTodayEarnings();
    }

    calculateStreak() {
        // Simplified streak calculation
        // In a real app, you'd track daily check-ins
        return Math.floor(Math.random() * 7) + 1;
    }

    async calculateTodayEarnings() {
        const today = new Date().toISOString().split('T')[0];
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', this.userProfile.id)
            .gte('created_at', today)
            .gt('amount', 0);

        if (!error && transactions) {
            const todayTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
            document.getElementById('todayEarnings').textContent = `Today: ₹${todayTotal.toFixed(2)}`;
        }
    }

    getTransactionType(type) {
        const types = {
            'signup_bonus': 'Signup Bonus',
            'task_completion': 'Task Reward',
            'ad_reward': 'Ad Watch',
            'daily_checkin': 'Daily Check-in',
            'referral_bonus': 'Referral Bonus',
            'withdrawal': 'Withdrawal'
        };
        return types[type] || type;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupRealTimeUpdates() {
        // Listen for balance updates
        supabase
            .channel('user_updates')
            .on('postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'users',
                    filter: `id=eq.${this.userProfile.id}`
                }, 
                (payload) => {
                    this.userProfile = { ...this.userProfile, ...payload.new };
                    localStorage.setItem('userProfile', JSON.stringify(this.userProfile));
                    this.updateUI();
                }
            )
            .subscribe();

        // Listen for new transactions
        supabase
            .channel('transaction_updates')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'transactions',
                    filter: `user_id=eq.${this.userProfile.id}`
                }, 
                () => {
                    this.loadRecentEarnings();
                    this.calculateTodayEarnings();
                }
            )
            .subscribe();
    }

    updateUI() {
        document.getElementById('userBalance').textContent = `₹${this.userProfile.balance}`;
        document.getElementById('mainBalance').textContent = `₹${this.userProfile.balance}`;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});
