<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'suffix' => $this->suffix,
            'sex' => $this->sex,
            'birth_date' => $this->birth_date,
            'civil_status' => $this->civil_status,
            'nationality' => $this->nationality,
            'contact_number' => $this->contact_number,
            'telephone' => $this->telephone,
            'house_no' => $this->house_no,
            'street' => $this->street,
            'barangay' => $this->barangay,
            'city_municipality' => $this->city_municipality,
            'province' => $this->province,
            'region' => $this->region,
            'zip_code' => $this->zip_code,
            'solo_parent_category' => $this->solo_parent_category,
            'solo_parent_since' => $this->solo_parent_since,
            'is_indigent' => $this->is_indigent,
            'num_children' => $this->num_children,
            'children' => $this->children,
            'employment_status' => $this->employment_status,
            'occupation' => $this->occupation,
            'employer_name' => $this->employer_name,
            'monthly_income' => $this->monthly_income,
            'educational_attainment' => $this->educational_attainment,
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_relationship' => $this->emergency_contact_relationship,
            'emergency_contact_address' => $this->emergency_contact_address,
            'emergency_contact_number' => $this->emergency_contact_number,
            'philsys_card_number' => $this->philsys_card_number,
            'place_of_birth' => $this->place_of_birth,
            'religion' => $this->religion,
            'company_agency' => $this->company_agency,
            'is_4ps_beneficiary' => $this->is_4ps_beneficiary,
            'household_id_4ps' => $this->household_id_4ps,
            'is_indigenous' => $this->is_indigenous,
            'indigenous_affiliation' => $this->indigenous_affiliation,
            'is_lgbtqia' => $this->is_lgbtqia,
            'is_pwd' => $this->is_pwd,
            'household_members' => $this->household_members,
            'solo_parent_classification' => $this->solo_parent_classification,
            'needs_problems' => $this->needs_problems,
            'signature_data' => $this->signature_data,
            'signature_updated_at' => $this->signature_updated_at ? $this->signature_updated_at->toIso8601String() : null,
            'updated_at' => $this->updated_at ? $this->updated_at->toIso8601String() : null,
        ];
    }
}
