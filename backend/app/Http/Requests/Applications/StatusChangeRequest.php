<?php

namespace App\Http\Requests\Applications;

use Illuminate\Foundation\Http\FormRequest;

class StatusChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string'],
            'note' => ['nullable', 'string'],
            'id_card_number' => ['nullable', 'string'],
            'case_number' => ['nullable', 'string'],
            'beneficiary_code' => ['nullable', 'string'],
            'solo_parent_category' => ['nullable', 'string'],
            'date_issued' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'string'],
        ];
    }
}
