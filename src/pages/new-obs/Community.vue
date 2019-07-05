<template>
  <v-ons-page>
    <!-- FIXME add confirmation to cancel -->
    <custom-toolbar back-label="Cancel" title="Community observation">
      <template v-slot:right>
        <v-ons-toolbar-button @click="onSave">Save</v-ons-toolbar-button>
      </template>
    </custom-toolbar>
    <v-ons-list>
      <v-ons-list-item
        v-for="(curr, $index) in species"
        :key="curr.id"
        expandable
      >
        <div class="left">
          <!-- FIXME make button to attach photo, or force user to take photo when adding? -->
          <img class="list-item__thumbnail" src="FIXME" />
        </div>
        <div class="center">
          <!-- FIXME make input so user can select species, suggest recent or close by species -->
          <span class="list-item__title">{{ curr.speciesName }}</span>
        </div>
        <div class="right">
          <v-ons-input
            v-model="curr.count"
            type="number"
            class="count-input"
            @click.stop
          ></v-ons-input>
        </div>
        <div class="expandable-content text-right">
          <v-ons-select v-model="curr.countAccuracy" class="count-accuracy">
            <option
              v-for="item in countAccuracies"
              :key="item.value"
              :value="item.value"
            >
              {{ item.text }}
            </option>
          </v-ons-select>
          <v-ons-button class="count-btn" @click="adjustCount($index, -10)"
            >-10</v-ons-button
          >
          <v-ons-button class="count-btn" @click="adjustCount($index, -1)"
            >-</v-ons-button
          >
          <v-ons-button class="count-btn" @click="adjustCount($index, +1)"
            >+</v-ons-button
          >
          <v-ons-button class="count-btn" @click="adjustCount($index, +10)"
            >+10</v-ons-button
          >
        </div>
      </v-ons-list-item>
    </v-ons-list>
    <v-ons-fab position="bottom right" @click="onNewSpeciesBtn">
      <v-ons-icon icon="md-plus"></v-ons-icon>
    </v-ons-fab>
  </v-ons-page>
</template>

<script>
export default {
  name: 'Community',
  data() {
    return {
      species: [],
      idGenerator: 0,
      countAccuracies: [
        // FIXME pull from server?
        { value: 'EXA', text: 'Exact' },
        { value: 'EST', text: 'Estimate' },
      ],
    }
  },
  methods: {
    async onSave() {
      this.$ons.notification.toast('FIXME implement this', {
        timeout: 5000,
        animation: 'ascend',
      })
    },
    onNewSpeciesBtn() {
      const id = this.idGenerator++
      this.species.push({
        id,
        photoThumbnail: '', // FIXME
        speciesName: 'Species ' + id,
        count: 1,
        countAccuracy: this.countAccuracies[0].value,
      })
    },
    adjustCount(index, amount) {
      this.species[index].count += amount
    },
  },
}
</script>

<style scoped lang="scss">
.count-btn {
  margin-left: 5px;
}

.count-input {
  width: 3em;
}

.count-accuracy {
  width: 40%;
}
</style>
