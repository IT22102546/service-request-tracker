<?php

namespace App\Http\Requests;

use App\Enums\RequestPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only title, description and priority are accepted. Any created_by,
     * status or version sent by the client is ignored.
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:100'],
            'description' => ['required', 'string', 'min:10', 'max:500'],
            'priority' => ['required', 'string', Rule::enum(RequestPriority::class)],
        ];
    }
}
