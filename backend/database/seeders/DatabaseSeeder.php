<?php

namespace Database\Seeders;

use App\Enums\RequestPriority;
use App\Enums\RequestStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Two local demo accounts (password: "password") with a few requests each,
     * so cross-user isolation can be checked by hand.
     */
    public function run(): void
    {
        $alice = User::updateOrCreate(
            ['email' => 'alice@example.com'],
            ['name' => 'Alice Perera', 'password' => 'password'],
        );

        $bob = User::updateOrCreate(
            ['email' => 'bob@example.com'],
            ['name' => 'Bob Fernando', 'password' => 'password'],
        );

        $this->seedRequests($alice, [
            ['Printer not working', 'Office printer on floor 2 stopped responding.', RequestPriority::HIGH],
            ['Request new monitor', 'Second monitor needed for the finance workstation.', RequestPriority::LOW],
            ['VPN keeps disconnecting', 'VPN drops every 10 minutes when working remotely.', RequestPriority::MEDIUM],
        ]);

        $this->seedRequests($bob, [
            ['Laptop battery swelling', 'Laptop battery is swollen and the case is lifting.', RequestPriority::HIGH],
            ['Access to shared drive', 'Need read access to the procurement shared drive.', RequestPriority::MEDIUM],
        ]);
    }

    /** @param list<array{0:string,1:string,2:RequestPriority}> $rows */
    private function seedRequests(User $owner, array $rows): void
    {
        if ($owner->serviceRequests()->exists()) {
            return;
        }

        foreach ($rows as [$title, $description, $priority]) {
            $request = new ServiceRequest([
                'title' => $title,
                'description' => $description,
                'priority' => $priority,
            ]);
            $request->created_by = $owner->id;
            $request->status = RequestStatus::OPEN;
            $request->save();
        }
    }
}
