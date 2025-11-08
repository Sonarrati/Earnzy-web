// js/tasks.js
class TasksManager {
    constructor() {
        this.userProfile = null;
        this.currentTask = null;
        this.tasks = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadTasks();
        this.setupEventListeners();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        this.userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        this.updateBalance();
    }

    updateBalance() {
        document.getElementById('userBalance').textContent = `₹${this.userProfile.balance || '0.00'}`;
    }

    async loadTasks(category = 'all') {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-spinner fa-spin text-3xl text-gray-400 mb-3"></i>
                <div class="text-gray-500">Loading tasks...</div>
            </div>
        `;

        let query = supabase
            .from('tasks')
            .select('*')
            .eq('status', 'active');

        if (category !== 'all') {
            query = query.eq('category', category);
        }

        const { data: tasks, error } = await query;

        if (error) {
            console.error('Error loading tasks:', error);
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                    <div>Error loading tasks</div>
                </div>
            `;
            return;
        }

        this.tasks = tasks || [];

        if (this.tasks.length === 0) {
            document.getElementById('noTasksMessage').classList.remove('hidden');
            container.innerHTML = '';
            return;
        }

        document.getElementById('noTasksMessage').classList.add('hidden');
        this.renderTasks(this.tasks);
    }

    renderTasks(tasks) {
        const container = document.getElementById('tasksContainer');
        
        container.innerHTML = tasks.map(task => `
            <div class="task-card bg-white rounded-xl p-4 shadow-md border-l-4 border-green-500">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-gray-800 text-lg">${task.title}</h3>
                    <span class="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-medium">
                        ₹${task.payout}
                    </span>
                </div>
                
                <p class="text-gray-600 text-sm mb-4">${task.description}</p>
                
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                        <div class="flex items-center space-x-1">
                            <i class="fas fa-clock"></i>
                            <span>${task.time_required || 5} mins</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <i class="fas fa-users"></i>
                            <span>${task.completed_count || 0} completed</span>
                        </div>
                    </div>
                    
                    <button 
                        onclick="tasksManager.openTaskModal('${task.id}')"
                        class="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition"
                    >
                        Start Task
                    </button>
                </div>
            </div>
        `).join('');
    }

    async openTaskModal(taskId) {
        this.currentTask = this.tasks.find(t => t.id === taskId);
        
        if (!this.currentTask) return;

        // Check if user already submitted this task
        const { data: existingSubmission } = await supabase
            .from('task_submissions')
            .select('id, status')
            .eq('user_id', this.userProfile.id)
            .eq('task_id', taskId)
            .single();

        if (existingSubmission) {
            if (existingSubmission.status === 'pending') {
                alert('You have already submitted proof for this task. Waiting for admin approval.');
                return;
            } else if (existingSubmission.status === 'approved') {
                alert('You have already completed this task and received payment.');
                return;
            }
        }

        document.getElementById('modalTaskTitle').textContent = this.currentTask.title;
        document.getElementById('modalTaskReward').textContent = `₹${this.currentTask.payout}`;
        document.getElementById('modalTaskTime').textContent = `${this.currentTask.time_required || 5} minutes`;
        document.getElementById('modalTaskDescription').textContent = this.currentTask.description;

        // Reset form
        document.getElementById('proofImage').value = '';
        document.getElementById('proofText').value = '';
        document.getElementById('imagePreview').classList.add('hidden');

        document.getElementById('taskModal').classList.remove('hidden');
    }

    closeTaskModal() {
        document.getElementById('taskModal').classList.add('hidden');
        this.currentTask = null;
    }

    async submitTaskProof() {
        if (!this.currentTask) return;

        const submitBtn = document.getElementById('submitProofBtn');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const proofImage = document.getElementById('proofImage').files[0];
            const proofText = document.getElementById('proofText').value.trim();

            if (!proofImage && !proofText) {
                alert('Please provide either an image or text proof');
                return;
            }

            let proofUrl = '';

            // Upload image if provided
            if (proofImage) {
                const fileExt = proofImage.name.split('.').pop();
                const fileName = `${this.userProfile.id}/${this.currentTask.id}-${Date.now()}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                    .from('proofs')
                    .upload(fileName, proofImage);

                if (error) throw error;
                proofUrl = fileName;
            }

            // Create task submission
            const submission = {
                user_id: this.userProfile.id,
                task_id: this.currentTask.id,
                proof_url: proofUrl,
                note: proofText,
                status: 'pending',
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('task_submissions')
                .insert([submission]);

            if (error) throw error;

            alert('Proof submitted successfully! It will be reviewed by our admin team within 24 hours.');
            this.closeTaskModal();

        } catch (error) {
            console.error('Error submitting proof:', error);
            alert('Error submitting proof: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    setupEventListeners() {
        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active button
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.classList.remove('bg-green-600', 'text-white');
                    b.classList.add('bg-white', 'text-gray-700', 'border', 'border-gray-300');
                });
                
                btn.classList.remove('bg-white', 'text-gray-700', 'border', 'border-gray-300');
                btn.classList.add('bg-green-600', 'text-white');

                // Load tasks for category
                this.loadTasks(btn.dataset.category);
            });
        });

        // Image preview
        document.getElementById('proofImage').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('previewImg').src = e.target.result;
                    document.getElementById('imagePreview').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

const tasksManager = new TasksManager();

// Global functions for HTML onclick
function closeTaskModal() {
    tasksManager.closeTaskModal();
}

function submitTaskProof() {
    tasksManager.submitTaskProof();
}
