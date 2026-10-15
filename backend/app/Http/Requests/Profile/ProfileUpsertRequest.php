<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;

class ProfileUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // We'll authorize in the controller
    }

    public function rules(): array
    {
        return [
            'first_name' => ['nullable', 'string', 'max:120'],
            'middle_name' => ['nullable', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'suffix' => ['nullable', 'string', 'max:20'],
            'sex' => ['nullable', 'string', 'max:20'],
            'birth_date' => ['nullable', 'string', 'max:20'],
            'civil_status' => ['nullable', 'string', 'max:40'],
            'nationality' => ['nullable', 'string', 'max:60'],
            'contact_number' => ['nullable', 'string', 'max:40'],
            'telephone' => ['nullable', 'string', 'max:40'],
            'house_no' => ['nullable', 'string', 'max:120'],
            'street' => ['nullable', 'string', 'max:160'],
            'barangay' => ['nullable', 'string', 'max:120'],
            'barangay_id' => ['nullable', 'string', 'max:36'],
            'city_municipality' => ['nullable', 'string', 'max:120'],
            'province' => ['nullable', 'string', 'max:120'],
            'region' => ['nullable', 'string', 'max:120'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'solo_parent_category' => ['nullable', 'string', 'max:200'],
            'solo_parent_since' => ['nullable', 'string', 'max:20'],
            'is_indigent' => ['nullable', 'boolean'],
            'num_children' => ['nullable', 'integer'],
            'children' => ['nullable', 'array'],
            'employment_status' => ['nullable', 'string', 'max:60'],
            'occupation' => ['nullable', 'string', 'max:160'],
            'employer_name' => ['nullable', 'string', 'max:200'],
            'monthly_income' => ['nullable', 'string', 'max:60'],
            'educational_attainment' => ['nullable', 'string', 'max:120'],
            'emergency_contact_name' => ['nullable', 'string', 'max:200'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:120'],
            'emergency_contact_address' => ['nullable', 'string', 'max:300'],
            'emergency_contact_number' => ['nullable', 'string', 'max:40'],
            'philsys_card_number' => ['nullable', 'string', 'max:40'],
            'place_of_birth' => ['nullable', 'string', 'max:200'],
            'religion' => ['nullable', 'string', 'max:120'],
            'company_agency' => ['nullable', 'string', 'max:200'],
            'is_4ps_beneficiary' => ['nullable', 'boolean'],
            'household_id_4ps' => ['nullable', 'string', 'max:60'],
            'is_indigenous' => ['nullable', 'boolean'],
            'indigenous_affiliation' => ['nullable', 'string', 'max:160'],
            'is_lgbtqia' => ['nullable', 'boolean'],
            'is_pwd' => ['nullable', 'boolean'],
            'household_members' => ['nullable', 'array'],
            'solo_parent_classification' => ['nullable', 'string'],
            'needs_problems' => ['nullable', 'string'],
            'signature_data' => ['nullable', 'string'],
        ];
    }
}
