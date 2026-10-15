<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $categoryId = (string) Str::uuid();
        
        DB::table('solo_parent_categories')->insert([
            'id' => $categoryId,
            'code' => 'RENEWAL',
            'name' => 'Renewal Application',
            'description' => 'Used for renewing an existing Solo Parent ID',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $requirements = [
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Affidavit of solo parent',
                'description' => 'Notarized affidavit of being a solo parent',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Affidavit of barangay official',
                'description' => 'Notarized affidavit from a barangay official',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Income Tax Return',
                'description' => 'Latest Income Tax Return (ITR)',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Original of solo parent id',
                'description' => 'Your previously issued and expired Solo Parent ID',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => '1x1 picture',
                'description' => 'Recent 1x1 ID picture',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        DB::table('documentary_requirements')->insert($requirements);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $category = DB::table('solo_parent_categories')->where('code', 'RENEWAL')->first();
        if ($category) {
            DB::table('documentary_requirements')->where('category_id', $category->id)->delete();
            DB::table('solo_parent_categories')->where('id', $category->id)->delete();
        }
    }
};
