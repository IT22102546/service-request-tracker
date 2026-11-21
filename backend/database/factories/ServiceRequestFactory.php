<?php

namespace Database\Factories;

use App\Enums\RequestPriority;
use App\Enums\RequestStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServiceRequest>
 */
class ServiceRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'created_by' => User::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'priority' => fake()->randomElement(RequestPriority::cases()),
            'status' => RequestStatus::OPEN,
            'version' => 1,
        ];
    }

    public function status(RequestStatus $status, int $version = 1): static
    {
        return $this->state(fn () => ['status' => $status, 'version' => $version]);
    }
}
