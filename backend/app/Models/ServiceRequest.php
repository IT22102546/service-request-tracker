<?php

namespace App\Models;

use App\Enums\RequestPriority;
use App\Enums\RequestStatus;
use Database\Factories\ServiceRequestFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceRequest extends Model
{
    /** @use HasFactory<ServiceRequestFactory> */
    use HasFactory;

    /**
     * Only user-editable fields are mass assignable. created_by, status and
     * version are always set by the server, never taken from the client.
     */
    protected $fillable = ['title', 'description', 'priority'];

    protected $attributes = [
        'status' => 'OPEN',
        'version' => 1,
    ];

    protected function casts(): array
    {
        return [
            'priority' => RequestPriority::class,
            'status' => RequestStatus::class,
            'version' => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(RequestStatusHistory::class);
    }
}
