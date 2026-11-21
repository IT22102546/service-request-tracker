<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\RequestStatusHistory */
class StatusHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'service_request_id' => $this->service_request_id,
            'from_status' => $this->from_status->value,
            'to_status' => $this->to_status->value,
            'remark' => $this->remark,
            'actor' => [
                'id' => $this->actor_user_id,
                'name' => $this->whenLoaded('actor', fn () => $this->actor->name),
            ],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
