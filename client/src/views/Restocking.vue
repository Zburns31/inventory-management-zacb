<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking</h2>
      <p>Set your budget and get AI-powered restocking recommendations based on demand forecasts</p>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Budget Slider Section -->
      <div class="card budget-card">
        <div class="card-header">
          <h3 class="card-title">Budget & Recommendations</h3>
        </div>
        <div class="budget-section">
          <div class="budget-input-group">
            <label>Available Budget: {{ currencySymbol }}{{ budget.toLocaleString() }}</label>
            <input
              v-model.number="budget"
              type="range"
              min="1000"
              max="100000"
              step="1000"
              class="budget-slider"
            />
            <div class="budget-range">
              <span>{{ currencySymbol }}1,000</span>
              <span>{{ currencySymbol }}100,000</span>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <div class="stat-label">Items Selected</div>
              <div class="stat-value">{{ selectedItems.length }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Quantity</div>
              <div class="stat-value">{{ totalQuantity }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Cost</div>
              <div class="stat-value">{{ currencySymbol }}{{ totalCost.toLocaleString() }}</div>
            </div>
            <div class="stat-item" :class="{ over: remainingBudget < 0 }">
              <div class="stat-label">Remaining Budget</div>
              <div class="stat-value">{{ currencySymbol }}{{ remainingBudget.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recommendations Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recommended Items ({{ recommendations.length }})</h3>
        </div>
        <div class="table-container">
          <table class="recommendations-table">
            <thead>
              <tr>
                <th class="col-select">
                  <input
                    type="checkbox"
                    :checked="allItemsSelected"
                    @change="toggleAllItems"
                  />
                </th>
                <th class="col-sku">SKU</th>
                <th class="col-name">Item Name</th>
                <th class="col-demand">Current Demand</th>
                <th class="col-demand">Forecasted Demand</th>
                <th class="col-quantity">Recommended Qty</th>
                <th class="col-cost">Unit Cost</th>
                <th class="col-cost">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recommendations" :key="item.sku" :class="{ selected: isItemSelected(item.sku) }">
                <td class="col-select">
                  <input
                    type="checkbox"
                    :checked="isItemSelected(item.sku)"
                    @change="toggleItem(item)"
                  />
                </td>
                <td class="col-sku"><strong>{{ item.sku }}</strong></td>
                <td class="col-name">{{ item.name }}</td>
                <td class="col-demand">{{ item.current_demand }}</td>
                <td class="col-demand"><strong>{{ item.forecasted_demand }}</strong></td>
                <td class="col-quantity">
                  <input
                    v-if="isItemSelected(item.sku)"
                    v-model.number="getItemData(item.sku).quantity"
                    type="number"
                    min="1"
                    class="quantity-input"
                  />
                  <span v-else>-</span>
                </td>
                <td class="col-cost">{{ currencySymbol }}{{ item.unit_cost }}</td>
                <td class="col-cost"><strong>{{ currencySymbol }}{{ (getItemData(item.sku).quantity * item.unit_cost).toLocaleString() }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Place Order Button -->
      <div class="action-section">
        <button
          @click="submitOrder"
          :disabled="selectedItems.length === 0 || remainingBudget < 0 || isSubmitting"
          class="submit-button"
        >
          {{ isSubmitting ? 'Submitting...' : 'Place Order' }}
        </button>
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="success-message">
        <p>{{ successMessage }}</p>
        <p>Lead time: {{ leadTimeMessage }}</p>
        <router-link to="/orders" class="view-orders-link">View in Orders Tab →</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'Restocking',
  setup() {
    const { currentCurrency } = useI18n()
    const loading = ref(true)
    const error = ref(null)
    const budget = ref(50000)
    const demands = ref([])
    const inventory = ref([])
    const selectedItems = ref([])
    const isSubmitting = ref(false)
    const successMessage = ref('')
    const leadTimeMessage = ref('')

    const currencySymbol = computed(() => {
      return currentCurrency.value === 'JPY' ? '¥' : '$'
    })

    const recommendations = computed(() => {
      // Match demand forecasts with inventory items
      return demands.value
        .map(demand => {
          const invItem = inventory.value.find(inv => inv.sku === demand.item_sku)
          return {
            id: demand.id,
            sku: demand.item_sku,
            name: demand.item_name,
            current_demand: demand.current_demand,
            forecasted_demand: demand.forecasted_demand,
            unit_cost: invItem?.unit_cost || 25.00,
            warehouse: invItem?.warehouse || 'San Francisco'
          }
        })
        .sort((a, b) => b.forecasted_demand - a.forecasted_demand)
    })

    const totalQuantity = computed(() => {
      return selectedItems.value.reduce((sum, item) => sum + item.quantity, 0)
    })

    const totalCost = computed(() => {
      return selectedItems.value.reduce((sum, item) => {
        const rec = recommendations.value.find(r => r.sku === item.sku)
        return sum + (item.quantity * (rec?.unit_cost || 0))
      }, 0)
    })

    const remainingBudget = computed(() => {
      return budget.value - totalCost.value
    })

    const allItemsSelected = computed(() => {
      return selectedItems.length === recommendations.value.length &&
             recommendations.value.length > 0
    })

    const loadData = async () => {
      try {
        loading.value = true
        demands.value = await api.getDemandForecasts()
        inventory.value = await api.getInventory()
      } catch (err) {
        error.value = 'Failed to load data: ' + err.message
        console.error('Load error:', err)
      } finally {
        loading.value = false
      }
    }

    const isItemSelected = (sku) => {
      return selectedItems.value.some(item => item.sku === sku)
    }

    const getItemData = (sku) => {
      let item = selectedItems.value.find(i => i.sku === sku)
      if (!item) {
        // Get the default quantity from forecasted demand
        const rec = recommendations.value.find(r => r.sku === sku)
        item = {
          sku,
          quantity: rec?.forecasted_demand || 10
        }
        selectedItems.value.push(item)
      }
      return item
    }

    const toggleItem = (item) => {
      const idx = selectedItems.value.findIndex(i => i.sku === item.sku)
      if (idx >= 0) {
        selectedItems.value.splice(idx, 1)
      } else {
        selectedItems.value.push({
          sku: item.sku,
          quantity: item.forecasted_demand
        })
      }
    }

    const toggleAllItems = () => {
      if (allItemsSelected.value) {
        selectedItems.value = []
      } else {
        selectedItems.value = recommendations.value.map(item => ({
          sku: item.sku,
          quantity: item.forecasted_demand
        }))
      }
    }

    const submitOrder = async () => {
      if (selectedItems.length === 0 || remainingBudget.value < 0) return

      isSubmitting.value = true
      successMessage.value = ''

      try {
        const orderItems = selectedItems.value.map(item => {
          const rec = recommendations.value.find(r => r.sku === item.sku)
          return {
            sku: item.sku,
            name: rec?.name || item.sku,
            quantity: item.quantity,
            unit_cost: rec?.unit_cost || 25.00
          }
        })

        const response = await api.submitRestockingOrder({
          items: orderItems,
          budget: budget.value
        })

        successMessage.value = `✓ ${response.message}`
        leadTimeMessage.value = `${response.delivery_lead_time_days} days`

        // Reset form
        setTimeout(() => {
          selectedItems.value = []
          successMessage.value = ''
          leadTimeMessage.value = ''
        }, 5000)
      } catch (err) {
        error.value = 'Failed to submit order: ' + err.message
        console.error('Submit error:', err)
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(loadData)

    return {
      loading,
      error,
      budget,
      recommendations,
      selectedItems,
      isSubmitting,
      successMessage,
      leadTimeMessage,
      currencySymbol,
      totalQuantity,
      totalCost,
      remainingBudget,
      allItemsSelected,
      isItemSelected,
      getItemData,
      toggleItem,
      toggleAllItems,
      submitOrder
    }
  }
}
</script>

<style scoped>
.restocking {
  padding: 1.5rem 0;
}

.budget-card {
  margin-bottom: 1.5rem;
}

.budget-section {
  padding: 1.5rem;
}

.budget-input-group {
  margin-bottom: 1.5rem;
}

.budget-input-group label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 500;
  color: #0f172a;
  font-size: 0.95rem;
}

.budget-slider {
  width: 100%;
  height: 8px;
  border-radius: 5px;
  background: #e2e8f0;
  outline: none;
  -webkit-appearance: none;
}

.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.budget-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.budget-range {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-item {
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.stat-item.over {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #0f172a;
}

.stat-item.over .stat-value {
  color: #ef4444;
}

.recommendations-table {
  table-layout: fixed;
  width: 100%;
}

.col-select {
  width: 50px;
  text-align: center;
}

.col-sku {
  width: 100px;
}

.col-name {
  width: 200px;
}

.col-demand {
  width: 100px;
  text-align: center;
}

.col-quantity {
  width: 120px;
  text-align: center;
}

.col-cost {
  width: 100px;
  text-align: right;
}

.quantity-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  text-align: center;
  font-size: 0.875rem;
}

.quantity-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

tbody tr.selected {
  background-color: #eff6ff;
}

.action-section {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
  padding: 1.5rem 0;
}

.submit-button {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #2563eb;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.submit-button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  opacity: 0.6;
}

.success-message {
  padding: 1rem;
  margin-top: 1rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  color: #166534;
}

.success-message p {
  margin: 0.5rem 0;
  font-weight: 500;
}

.view-orders-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.view-orders-link:hover {
  text-decoration: underline;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h2 {
  font-size: 1.875rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: #64748b;
  font-size: 0.95rem;
}
</style>
