<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('barangays', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 160)->unique();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('applicant_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->unique()->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            $table->string('first_name', 120)->nullable();
            $table->string('middle_name', 120)->nullable();
            $table->string('last_name', 120)->nullable();
            $table->string('suffix', 20)->nullable();
            
            $table->string('sex', 20)->nullable();
            $table->string('birth_date', 20)->nullable();
            $table->string('contact_number', 40)->nullable();
            $table->string('telephone', 40)->nullable();
            
            $table->uuid('barangay_id')->nullable()->index();
            $table->foreign('barangay_id')->references('id')->on('barangays')->onDelete('set null');
            
            $table->string('house_no', 120)->nullable();
            $table->string('street', 160)->nullable();
            $table->string('city_municipality', 120)->nullable()->default('Butuan City');
            $table->string('province', 120)->nullable()->default('Agusan del Norte');
            $table->string('region', 120)->nullable()->default('Caraga');
            $table->string('zip_code', 20)->nullable()->default('8600');
            
            $table->boolean('is_profile_complete')->default(false);
            $table->timestamps();
        });

        Schema::create('solo_parent_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique()->index();
            $table->string('name', 220);
            $table->text('description')->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('documentary_requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('category_id')->index();
            $table->foreign('category_id')->references('id')->on('solo_parent_categories')->onDelete('cascade');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_required')->default(true);
            $table->timestamps();
        });

        Schema::create('applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            $table->string('reference_no', 40)->unique()->index();
            $table->string('application_type', 20)->default('new'); // 'new' or 'renewal'
            
            $table->uuid('category_id')->nullable()->index();
            $table->foreign('category_id')->references('id')->on('solo_parent_categories')->onDelete('set null');
            
            $table->string('status', 48)->default('draft')->index();
            $table->text('status_reason')->nullable();
            
            $table->string('id_card_number', 60)->nullable();
            $table->string('case_number', 40)->nullable();
            $table->string('beneficiary_code', 60)->nullable();
            $table->date('date_issued')->nullable();
            
            $table->uuid('previous_application_id')->nullable();
            $table->string('previous_id_card_number', 60)->nullable();
            $table->boolean('renewal_reminder_sent')->default(false);
            
            $table->boolean('is_form_complete')->default(false);
            $table->boolean('are_documents_complete')->default(false);
            
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('released_at')->nullable();
            
            $table->uuid('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            
            $table->timestamps();
        });

        Schema::create('application_forms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('application_id')->unique();
            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            
            // Personal & Classification
            $table->string('philsys_card_number', 40)->nullable();
            $table->string('place_of_birth', 200)->nullable();
            $table->string('civil_status', 40)->nullable();
            $table->string('religion', 120)->nullable();
            $table->string('nationality', 60)->nullable();
            $table->string('educational_attainment', 120)->nullable();
            $table->string('occupation', 160)->nullable();
            $table->string('employment_status', 60)->nullable();
            $table->string('employer_name', 200)->nullable();
            $table->string('company_agency', 200)->nullable();
            $table->string('monthly_income', 60)->nullable();
            
            // Flags
            $table->boolean('is_indigent')->default(false);
            $table->boolean('is_4ps_beneficiary')->default(false);
            $table->string('household_id_4ps', 60)->nullable();
            $table->boolean('is_indigenous')->default(false);
            $table->string('indigenous_affiliation', 160)->nullable();
            $table->boolean('is_lgbtqia')->default(false);
            $table->boolean('is_pwd')->default(false);
            
            // Solo Parent Details
            $table->string('solo_parent_since', 20)->nullable();
            $table->text('classification_details')->nullable();
            $table->text('needs_problems')->nullable();
            
            // Emergency Contact
            $table->string('emergency_contact_name', 200)->nullable();
            $table->string('emergency_contact_relationship', 120)->nullable();
            $table->string('emergency_contact_address', 300)->nullable();
            $table->string('emergency_contact_number', 40)->nullable();
            
            // Signature
            $table->longText('signature_data')->nullable();
            
            $table->timestamps();
        });

        Schema::create('application_family_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('application_id')->index();
            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            
            $table->string('member_type', 20); // 'child' or 'household'
            $table->string('name', 200);
            $table->string('relationship', 120)->nullable();
            $table->integer('age')->nullable();
            $table->string('civil_status', 60)->nullable();
            $table->string('educational_attainment', 120)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('monthly_income', 60)->nullable();
            
            $table->timestamps();
        });

        Schema::create('application_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('application_id')->index();
            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            
            $table->uuid('requirement_id')->index();
            $table->foreign('requirement_id')->references('id')->on('documentary_requirements')->onDelete('cascade');
            
            $table->uuid('user_id')->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            $table->string('original_filename', 400);
            $table->string('storage_path', 500);
            $table->string('mime_type', 120);
            $table->bigInteger('file_size')->default(0);
            
            $table->string('review_status', 32)->default('pending')->index();
            $table->text('review_note')->nullable();
            
            $table->uuid('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            
            $table->timestamps();
        });

        Schema::create('application_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('application_id')->index();
            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            
            $table->string('from_status', 48)->nullable();
            $table->string('to_status', 48);
            $table->text('note')->nullable();
            
            $table->uuid('changed_by')->nullable();
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('set null');
            
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('admin_id')->nullable()->index();
            $table->foreign('admin_id')->references('id')->on('users')->onDelete('set null');
            
            $table->string('action', 80)->index();
            $table->string('entity_type', 60)->nullable();
            $table->uuid('entity_id')->nullable();
            
            $table->jsonb('previous_state')->nullable();
            $table->jsonb('new_state')->nullable();
            $table->text('reason')->nullable();
            
            $table->string('ip_address', 60)->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            $table->string('type', 60);
            $table->string('title', 200);
            $table->text('message');
            $table->string('link', 300)->nullable();
            $table->boolean('is_read')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 240);
            $table->text('body');
            $table->string('category', 60)->default('general');
            $table->boolean('is_published')->default(true)->index();
            $table->timestamp('published_at')->nullable()->useCurrent();
            $table->uuid('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
        });
        
        $this->seedBarangays();
        $this->seedCategories();
    }

    private function seedBarangays()
    {
        $barangays = [
            'Agao Pob. (Bgy. 3)', 'Agusan Pequeño', 'Ambago', 'Amparo', 'Ampayon',
            'Anticala', 'Antongalon', 'Aupagan', 'Baan KM 3', 'Baan Riverside Pob. (Bgy. 20)',
            'Babag', 'Bading Pob. (Bgy. 22)', 'Bancasi', 'Banza', 'Baobaoan',
            'Basag', 'Bayanihan Pob. (Bgy. 27)', 'Bilay', 'Bit-os', 'Bitan-agan',
            'Bobon', 'Bonbon', 'Bugabus', 'Bugsukan', 'Buhangin Pob. (Bgy. 19)',
            'Cabcabon', 'Camayahan', 'Dagohoy Pob. (Bgy. 7)', 'Dankias', 'Datu Silongan',
            'De Oro', 'Diego Silang Pob. (Bgy. 6)', 'Don Francisco', 'Doongan', 'Dulag',
            'Dumalagan', 'Florida', 'Fort Poyohon Pob. (Bgy. 17)', 'Golden Ribbon Pob. (Bgy. 2)',
            'Holy Redeemer Pob. (Bgy. 23)', 'Humabon Pob. (Bgy. 11)', 'Imadejas Pob. (Bgy. 24)',
            'Jose Rizal Pob. (Bgy. 25)', 'Kinamlutan', 'Lapu-lapu Pob. (Bgy. 8)', 'Lemon',
            'Leon Kilat Pob. (Bgy. 13)', 'Libertad', 'Limaha Pob. (Bgy. 14)', 'Los Angeles',
            'Lumbocan', 'Maguinda', 'Mahay', 'Mahogany Pob. (Bgy. 21)', 'Maibu',
            'Mandamo', 'Manila de Bugabus', 'Maon Pob. (Bgy. 1)', 'Masao', 'Maug',
            'New Society Village Pob.', 'Nong-nong', 'Obrero Pob. (Bgy. 18)', 'Ong Yiu Pob. (Bgy. 16)',
            'Pagatpatan', 'Pangabugan', 'Pianing', 'Pigdaulan', 'Rajah Soliman Pob. (Bgy. 4)',
            'Salvacion', 'San Ignacio Pob. (Bgy. 15)', 'San Mateo', 'San Vicente', 'Santo Niño',
            'Sikatuna Pob. (Bgy. 10)', 'Silongan Pob. (Bgy. 5)', 'Sumile', 'Sumilihon',
            'Tagabaca', 'Taguibo', 'Taligaman', 'Tandang Sora Pob. (Bgy. 12)', 'Tiniwisan',
            'Tungao', 'Urduja Pob. (Bgy. 9)', 'Villa Kananga'
        ];

        foreach ($barangays as $name) {
            \Illuminate\Support\Facades\DB::table('barangays')->insert([
                'id'         => \Illuminate\Support\Str::uuid()->toString(),
                'name'       => $name,
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
    
    private function seedCategories()
    {
        $categories = [
            [
                'code' => 'A',
                'name' => 'Solo Parent due to death of spouse',
                'description' => 'A parent whose spouse has died.',
                'requirements' => [
                    'Death certificate of spouse',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'B',
                'name' => 'Solo Parent due to spouse being in jail',
                'description' => 'A parent whose spouse is detained for at least three (3) months.',
                'requirements' => [
                    'Certificate of Detention',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'C',
                'name' => 'Solo Parent due to annulment',
                'description' => 'A parent whose marriage has been annulled or declared void.',
                'requirements' => [
                    'Court Order of Annulment / Declaration of Nullity of Marriage',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'D',
                'name' => 'Solo Parent due to physical/mental incapacity of spouse',
                'description' => 'A parent whose spouse is physically or mentally incapacitated.',
                'requirements' => [
                    'Medical Certificate of incapacity',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'E',
                'name' => 'Solo Parent due to legal separation',
                'description' => 'A parent who is legally separated from spouse for at least 6 months.',
                'requirements' => [
                    'Court Order of Legal Separation',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'F',
                'name' => 'Solo Parent due to abandonment',
                'description' => 'A parent whose spouse has abandoned them for at least 6 months.',
                'requirements' => [
                    'Affidavit of Abandonment (2 disinterested persons)',
                    'Police or Barangay Blotter / Certificate',
                    'Birth certificate of children'
                ]
            ],
            [
                'code' => 'G',
                'name' => 'Unmarried parent',
                'description' => 'An unmarried person who has kept and reared children.',
                'requirements' => [
                    'CENOMAR (Certificate of No Marriage)',
                    'Birth certificate of children',
                    'Barangay certificate of residency'
                ]
            ],
            [
                'code' => 'H',
                'name' => 'Any other person bearing sole responsibility',
                'description' => 'Any person providing sole parental care and support to a child.',
                'requirements' => [
                    'Affidavit of Guardianship / Care',
                    'Barangay certificate of residency'
                ]
            ]
        ];

        foreach ($categories as $index => $cat) {
            $catId = \Illuminate\Support\Str::uuid()->toString();
            \Illuminate\Support\Facades\DB::table('solo_parent_categories')->insert([
                'id' => $catId,
                'code' => $cat['code'],
                'name' => $cat['name'],
                'description' => $cat['description'],
                'display_order' => $index,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            foreach ($cat['requirements'] as $reqName) {
                \Illuminate\Support\Facades\DB::table('documentary_requirements')->insert([
                    'id' => \Illuminate\Support\Str::uuid()->toString(),
                    'category_id' => $catId,
                    'name' => $reqName,
                    'is_required' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('application_status_history');
        Schema::dropIfExists('application_documents');
        Schema::dropIfExists('application_family_members');
        Schema::dropIfExists('application_forms');
        Schema::dropIfExists('applications');
        Schema::dropIfExists('documentary_requirements');
        Schema::dropIfExists('solo_parent_categories');
        Schema::dropIfExists('applicant_profiles');
        Schema::dropIfExists('barangays');
    }
};
