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
            'code' => 'LOSS_SPIC',
            'name' => 'Loss of SPIC',
            'description' => 'Used for replacing a lost Solo Parent ID Card',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $requirements = [
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Affidavit of Loss',
                'description' => 'Notarized Affidavit of Loss detailing how the ID was lost',
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
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Sworn affidavit',
                'description' => 'Sworn affidavit declaring sole parental care',
                'is_required' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => (string) Str::uuid(),
                'category_id' => $categoryId,
                'name' => 'Affidavit of a barangay official',
                'description' => 'Affidavit of a barangay official attesting to your residency',
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
        $category = DB::table('solo_parent_categories')->where('code', 'LOSS_SPIC')->first();
        if ($category) {
            DB::table('documentary_requirements')->where('category_id', $category->id)->delete();
            DB::table('solo_parent_categories')->where('id', $category->id)->delete();
        }
    }
};
